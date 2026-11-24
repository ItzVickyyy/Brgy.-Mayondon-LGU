import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  DatabaseBackup,
  FileUp,
  Info,
  type LucideIcon,
  OctagonAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { type NotificationItem, NotificationsService } from "@/client"
import { DataKeyDialog } from "@/components/Security/DataKeyDialog"
import { PlainHttpDialog } from "@/components/Security/PlainHttpDialog"
import { useDataProtection } from "@/components/Security/useDataProtection"
import { SecurityQuestionsDialog } from "@/components/SecurityQuestions/SecurityQuestionsDialog"
import { TwoFactorSetupDialog } from "@/components/TwoFactor/TwoFactorSetupDialog"
import { UpdateDialog } from "@/components/Updates/UpdateDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from "@/hooks/useAuth"
import { useDeferredStart } from "@/hooks/useDeferredStart"
import { isSystemAdministrator } from "@/lib/access"
import { getLocale } from "@/lib/locale"
import { noticeSentence } from "@/lib/notifications"
import {
  type ReminderSeverity,
  type SetupReminder,
  snoozeHttpReminder,
  useSetupReminders,
} from "./useSetupReminders"

// Three clearly different colours (and icons, so colour is never the only cue):
// red = needs action now, amber = soon, blue = optional. A reminder is a plain
// card with a solid stripe on its left edge and a solid label (no tinted fill).
const SEVERITY_STRIPE: Record<ReminderSeverity, string> = {
  urgent: "border-l-red-600 dark:border-l-red-400",
  soon: "border-l-amber-500 dark:border-l-amber-400",
  optional: "border-l-blue-600 dark:border-l-blue-400",
}
const SEVERITY_LABEL: Record<ReminderSeverity, string> = {
  urgent: "bg-red-700 text-white dark:bg-red-400 dark:text-red-950",
  soon: "bg-amber-400 text-amber-950 dark:bg-amber-400 dark:text-amber-950",
  optional: "bg-blue-700 text-white dark:bg-blue-400 dark:text-blue-950",
}
const SEVERITY_ICON: Record<ReminderSeverity, LucideIcon> = {
  urgent: OctagonAlert,
  soon: Clock,
  optional: Info,
}

// One icon per kind of notice, taken from the start of the audit action
// ("user.update" -> account, "auth.mfa_enabled" -> security, and so on).
function noticeIcon(action: string): LucideIcon {
  const area = action.split(".")[0]
  if (area === "user") return UserRound
  if (area === "auth") return ShieldCheck
  if (area === "backup") return DatabaseBackup
  if (area === "import") return FileUp
  return SlidersHorizontal
}

type DayGroup = "today" | "yesterday" | "earlier"

// Groups by calendar day in this computer's time zone, newest first (the server
// already sends them newest first, so the order inside a group is kept).
function dayGroup(occurredAt: string, now: number): DayGroup {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const at = Date.parse(occurredAt)
  if (at >= startOfToday.getTime()) return "today"
  if (at >= startOfToday.getTime() - DAY) return "yesterday"
  return "earlier"
}

const DAY_GROUPS: DayGroup[] = ["today", "yesterday", "earlier"]

// The list comes from the server (the audit log, filtered by role) and the
// read state is kept per person there, so it is the same on every computer.
// It is refreshed about every 45 seconds while the page is visible, when the
// window gets focus again and when the menu opens. No websockets.
// The key carries the account, so one person's list is never drawn for the
// next person who signs in on the same browser.
const queryKeyFor = (ownerId: string) => ["notifications", ownerId] as const
const REFRESH_MS = 45_000

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type BellData = { data: NotificationItem[]; unread_count: number }

function timeAgo(occurredAt: string, now: number): string {
  const formatter = new Intl.RelativeTimeFormat(getLocale(), {
    numeric: "auto",
  })
  const age = Math.max(0, now - Date.parse(occurredAt))
  if (age < MINUTE) return formatter.format(0, "second")
  if (age < HOUR) return formatter.format(-Math.floor(age / MINUTE), "minute")
  if (age < DAY) return formatter.format(-Math.floor(age / HOUR), "hour")
  return formatter.format(-Math.floor(age / DAY), "day")
}

// Re-reads the clock every 30 seconds so "5 minutes ago" keeps up while open.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

// The bubble next to the bell: a few words at a time, like the label that
// appears beside an icon of the collapsed sidebar, but on a loop. It shows
// one message for SHOW_MS, hides for HIDE_MS, then shows the next one. It
// stops while the list is open and is not drawn at all for people who asked
// their system for reduced motion.
const FIRST_DELAY_MS = 1500
const SHOW_MS = 4000
const HIDE_MS = 2500

function useTeaserLoop(messages: string[], paused: boolean) {
  const [shown, setShown] = useState(0)
  const [visible, setVisible] = useState(false)
  const count = messages.length

  useEffect(() => {
    if (count === 0 || paused) {
      setVisible(false)
      return
    }
    const wait = visible ? SHOW_MS : shown === 0 ? FIRST_DELAY_MS : HIDE_MS
    const timer = window.setTimeout(() => {
      if (visible) {
        setVisible(false)
      } else {
        setShown((n) => n + 1)
        setVisible(true)
      }
    }, wait)
    return () => window.clearTimeout(timer)
  }, [count, paused, visible, shown])

  const text = count === 0 ? "" : messages[Math.max(shown - 1, 0) % count]
  return { text, visible: visible && count > 0 }
}

function ReminderRow({
  reminder,
  onAction,
}: {
  reminder: SetupReminder
  onAction: (id: SetupReminder["id"]) => void
}) {
  const { t } = useTranslation()
  const SeverityIcon = SEVERITY_ICON[reminder.severity]
  return (
    <li
      data-testid={reminder.testId}
      data-severity={reminder.severity}
      className={`mx-3 mb-2 rounded-md border border-l-4 bg-card px-3 py-3 text-card-foreground last:mb-3 ${SEVERITY_STRIPE[reminder.severity]}`}
    >
      <p
        className={`mb-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_LABEL[reminder.severity]}`}
      >
        <SeverityIcon aria-hidden="true" className="size-3" />
        {t(`notifications.priority.${reminder.severity}`)}
      </p>
      {reminder.title ? (
        <p className="break-words text-sm font-medium leading-5">
          {reminder.title}
        </p>
      ) : null}
      <p
        className={`break-words text-sm leading-5 ${reminder.title ? "mt-1" : ""}`}
      >
        {reminder.text}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11 sm:min-h-8"
          onClick={() => onAction(reminder.id)}
        >
          {reminder.action}
        </Button>
        {reminder.onDismiss ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 sm:min-h-8"
            onClick={reminder.onDismiss}
          >
            {reminder.dismissLabel}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationItem
  onRead: (id: number) => void
}) {
  const now = useNow()
  const { t } = useTranslation()
  const Icon = noticeIcon(item.action)
  const failed = item.outcome !== "success"
  return (
    <li
      data-testid="notification-item"
      data-read={item.read ? "true" : "false"}
      data-action={item.action}
      className={`flex items-start gap-3 border-b px-3 py-3 last:border-b-0 ${
        item.read ? "" : "bg-brand/5"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          failed
            ? "bg-destructive text-white"
            : item.read
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`break-words text-sm leading-5 ${
            item.read ? "text-muted-foreground" : "font-medium"
          }`}
        >
          {item.read ? null : (
            <span className="sr-only">{t("notifications.unread")}: </span>
          )}
          {noticeSentence(item)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {timeAgo(item.occurred_at, now)}
        </p>
      </div>
      {item.read ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-muted-foreground sm:size-8"
          aria-label={t("notifications.markRead")}
          title={t("notifications.markRead")}
          onClick={() => onRead(item.id)}
        >
          <Check className="size-4" aria-hidden="true" />
        </Button>
      )}
    </li>
  )
}

function patchCache(
  queryClient: QueryClient,
  key: readonly unknown[],
  change: (current: BellData) => BellData,
) {
  queryClient.setQueryData<BellData>(key, (current) =>
    current ? change(current) : current,
  )
}

export function NotificationBell({ ownerId }: { ownerId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = queryKeyFor(ownerId)
  // The first request waits a second so the page itself draws first (patch 237).
  const ready = useDeferredStart()

  const bell = useQuery({
    queryKey,
    enabled: ready,
    queryFn: async () => (await NotificationsService.listNotifications()).data,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })
  const notifications = bell.data?.data ?? []
  const unreadCount = bell.data?.unread_count ?? 0

  const markOne = useMutation({
    mutationFn: async (id: number) =>
      NotificationsService.markNotificationRead({
        path: { notification_id: id },
      }),
    onMutate: (id) =>
      patchCache(queryClient, queryKey, (current) => {
        const wasUnread = current.data.some((i) => i.id === id && !i.read)
        return {
          data: current.data.map((i) =>
            i.id === id ? { ...i, read: true } : i,
          ),
          unread_count: Math.max(0, current.unread_count - (wasUnread ? 1 : 0)),
        }
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const markAll = useMutation({
    mutationFn: async () => NotificationsService.markAllNotificationsRead(),
    onMutate: () =>
      patchCache(queryClient, queryKey, (current) => ({
        data: current.data.map((i) => ({ ...i, read: true })),
        unread_count: 0,
      })),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const reminders = useSetupReminders()
  const [menuOpen, setMenuOpen] = useState(false)
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [httpOpen, setHttpOpen] = useState(false)
  const [dataKeyOpen, setDataKeyOpen] = useState(false)
  const { user: signedIn } = useAuth()
  // Same query as the reminder (fetched once); only the dialog's wording is read here.
  const protectionData = useDataProtection(
    Boolean(signedIn) && isSystemAdministrator(signedIn) && ready,
  ).data
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const now = useNow()
  const shown =
    filter === "unread" ? notifications.filter((i) => !i.read) : notifications
  const groups = DAY_GROUPS.map((group) => ({
    group,
    items: shown.filter((i) => dayGroup(i.occurred_at, now) === group),
  })).filter((g) => g.items.length > 0)

  // Reminders first, then the newest unread notices (a few words of each).
  const teaserMessages = [
    ...reminders.map((r) => r.teaser),
    ...notifications
      .filter((i) => !i.read)
      .slice(0, 3)
      .map((i) => noticeSentence(i)),
  ]
  const teaser = useTeaserLoop(teaserMessages, menuOpen)

  const navigate = useNavigate()

  const startReminder = (id: SetupReminder["id"]) => {
    setMenuOpen(false)
    const target = reminders.find((r) => r.id === id)?.to
    if (target) {
      void navigate({ to: target })
      return
    }
    // Let the menu finish closing before a dialog opens (focus handling).
    window.setTimeout(() => {
      if (id === "securityQuestions") setQuestionsOpen(true)
      else if (id === "update") setUpdateOpen(true)
      else if (id === "plainHttp") setHttpOpen(true)
      else if (id === "dataKey") setDataKeyOpen(true)
      else setTwoFactorOpen(true)
    }, 80)
  }

  // One red dot, top right: unread notices plus open reminders. The menu
  // itself keeps them apart ("Needs your attention" first, then the notices).
  const badgeCount = unreadCount + reminders.length

  const unreadLabel =
    unreadCount > 0
      ? t("notifications.bellUnread", { count: unreadCount })
      : t("notifications.bell")
  const label =
    reminders.length > 0
      ? `${unreadLabel}, ${t("notifications.reminderCount", { count: reminders.length })}`
      : unreadLabel

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        data-testid="notification-teaser"
        data-visible={teaser.visible ? "true" : "false"}
        className={`pointer-events-none fixed right-3 top-16 z-20 w-max max-w-[min(16rem,calc(100vw-1.5rem))] origin-right sm:absolute sm:right-full sm:top-1/2 sm:mr-3 sm:-translate-y-1/2 transition-all duration-300 ease-out motion-reduce:hidden ${
          teaser.visible
            ? "translate-x-0 opacity-100"
            : "translate-x-1 opacity-0"
        }`}
      >
        <div className="relative rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-md">
          <span className="absolute -right-1 top-1/2 hidden size-2 -translate-y-1/2 rotate-45 bg-foreground sm:block" />
          <span className="block truncate">{teaser.text}</span>
        </div>
      </div>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open)
          if (open) void bell.refetch()
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            data-testid="notification-bell"
            className="icon-react icon-bell relative size-9 shrink-0 border-border bg-muted/40 text-foreground hover:bg-muted"
            aria-label={label}
            title={t("notifications.bell")}
          >
            <Bell className="size-4" aria-hidden="true" />
            {badgeCount > 0 ? (
              <span
                data-testid="notification-badge"
                data-unread={unreadCount}
                data-reminders={reminders.length}
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white tabular-nums"
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="max-h-[min(34rem,var(--radix-dropdown-menu-content-available-height))] w-[min(25rem,calc(100vw-1.5rem))] overflow-y-auto p-0"
        >
          <div className="sticky top-0 z-10 bg-popover">
            <div className="flex items-center justify-between gap-2 border-t-2 border-t-brand px-3 py-2.5">
              <DropdownMenuLabel className="p-0">
                <span className="block text-sm font-semibold">
                  {t("notifications.title")}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {unreadCount > 0
                    ? t("notifications.unreadCount", { count: unreadCount })
                    : t("notifications.allCaughtUp")}
                </span>
              </DropdownMenuLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 gap-1.5 px-2 text-xs sm:min-h-8"
                disabled={unreadCount === 0}
                aria-label={t("notifications.markAllRead")}
                title={t("notifications.markAllRead")}
                onClick={() => markAll.mutate()}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                {t("notifications.markAllReadShort")}
              </Button>
            </div>
            {notifications.length > 0 ? (
              <fieldset
                aria-label={t("notifications.filter.label")}
                className="m-0 flex min-w-0 gap-1 border-0 border-b p-0 px-3 pb-2"
              >
                {(["all", "unread"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`notification-filter-${value}`}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`min-h-11 rounded-md px-3 text-xs font-medium sm:min-h-8 ${
                      filter === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {t(`notifications.filter.${value}`)}
                  </button>
                ))}
              </fieldset>
            ) : (
              <DropdownMenuSeparator className="m-0" />
            )}
          </div>
          {reminders.length > 0 ? (
            <section
              aria-label={t("notifications.needsAttention")}
              className="border-b"
            >
              <h3 className="px-3 pb-2 pt-3 text-xs font-semibold text-muted-foreground">
                {t("notifications.needsAttention")}
              </h3>
              <ul>
                {reminders.map((reminder) => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    onAction={startReminder}
                  />
                ))}
              </ul>
            </section>
          ) : null}
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm font-medium">{t("notifications.empty")}</p>
              <p className="text-xs text-muted-foreground">
                {t("notifications.emptyHintShared")}
              </p>
            </div>
          ) : shown.length === 0 ? (
            <p
              data-testid="notification-none-unread"
              className="px-4 py-8 text-center text-sm text-muted-foreground"
            >
              {t("notifications.noUnread")}
            </p>
          ) : (
            groups.map(({ group, items }) => (
              <section
                key={group}
                aria-label={t(`notifications.group.${group}`)}
              >
                <h3 className="border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  {t(`notifications.group.${group}`)}
                </h3>
                <ul>
                  {items.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onRead={(id) => markOne.mutate(id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the menu and always mounted: when two-factor turns on, the
        reminder goes away but the dialog must stay open to show the one-time
        recovery codes. */}
      <SecurityQuestionsDialog
        open={questionsOpen}
        onOpenChange={setQuestionsOpen}
      />
      <TwoFactorSetupDialog
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
      />
      {/* Always mounted, like the two above: the reminder disappears the moment the update
        starts, but the dialog must stay open to follow it. */}
      <UpdateDialog open={updateOpen} onOpenChange={setUpdateOpen} />
      {/* Always mounted, so it can finish closing after the key is added and the reminder goes. */}
      <DataKeyDialog
        open={dataKeyOpen}
        onOpenChange={setDataKeyOpen}
        kind={
          protectionData && protectionData.unreadable_count > 0
            ? "unreadable"
            : "missing"
        }
        count={protectionData?.unreadable_count ?? 0}
      />
      {/* Always mounted: "Remind me later" hides the reminder while the dialog is still closing. */}
      <PlainHttpDialog
        open={httpOpen}
        onOpenChange={setHttpOpen}
        onSnooze={() => {
          if (signedIn) snoozeHttpReminder(signedIn.id)
        }}
      />
    </div>
  )
}
