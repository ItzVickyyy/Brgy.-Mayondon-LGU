import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Bell, BellOff, Check, CheckCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { type NotificationItem, NotificationsService } from "@/client"
import { SecurityQuestionsDialog } from "@/components/SecurityQuestions/SecurityQuestionsDialog"
import { TwoFactorSetupDialog } from "@/components/TwoFactor/TwoFactorSetupDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getLocale } from "@/lib/locale"
import { noticeSentence } from "@/lib/notifications"
import {
  type ReminderSeverity,
  SEVERITY_ORDER,
  type SetupReminder,
  useSetupReminders,
} from "./useSetupReminders"

// Red = needs action now, orange = soon, green = optional.
const SEVERITY_BOX: Record<ReminderSeverity, string> = {
  urgent:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
  soon: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200",
  optional:
    "border-green-300 bg-green-50 text-green-900 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200",
}
const SEVERITY_DOT: Record<ReminderSeverity, string> = {
  urgent: "bg-red-600",
  soon: "bg-orange-500",
  optional: "bg-green-600",
}

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
  return (
    <li
      data-testid={reminder.testId}
      data-severity={reminder.severity}
      className={`border-b px-3 py-3 last:border-b-0 ${SEVERITY_BOX[reminder.severity]}`}
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">
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
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          item.read
            ? "bg-transparent"
            : item.outcome === "success"
              ? "bg-brand"
              : "bg-destructive"
        }`}
      />
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
          className="size-8 shrink-0 text-muted-foreground"
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

  const bell = useQuery({
    queryKey,
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
  const topSeverity =
    SEVERITY_ORDER.find((level) =>
      reminders.some((r) => r.severity === level),
    ) ?? "optional"

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
      else setTwoFactorOpen(true)
    }, 80)
  }

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
        className={`pointer-events-none absolute right-full top-1/2 z-20 mr-3 w-max max-w-[min(16rem,calc(100vw-8rem))] -translate-y-1/2 origin-right transition-all duration-300 ease-out motion-reduce:hidden ${
          teaser.visible
            ? "translate-x-0 opacity-100"
            : "translate-x-1 opacity-0"
        }`}
      >
        <div className="relative rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-md">
          <span className="absolute -right-1 top-1/2 size-2 -translate-y-1/2 rotate-45 bg-foreground" />
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
            className="relative size-9 shrink-0 border-border bg-muted/40 text-foreground hover:bg-muted"
            aria-label={label}
            title={t("notifications.bell")}
          >
            <Bell className="size-4" aria-hidden="true" />
            {unreadCount > 0 ? (
              <span
                data-testid="notification-badge"
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white tabular-nums"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
            {reminders.length > 0 ? (
              <span
                data-testid="notification-reminder-dot"
                data-severity={topSeverity}
                aria-hidden="true"
                className={`absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white tabular-nums ${SEVERITY_DOT[topSeverity]}`}
              >
                {reminders.length}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="max-h-[min(34rem,var(--radix-dropdown-menu-content-available-height))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto p-0"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <DropdownMenuLabel className="p-0 text-sm font-semibold">
              {t("notifications.title")}
              {unreadCount > 0 ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t("notifications.unreadCount", { count: unreadCount })}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={unreadCount === 0}
              aria-label={t("notifications.markAllRead")}
              title={t("notifications.markAllRead")}
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <DropdownMenuSeparator className="m-0" />
          {reminders.length > 0 ? (
            <section aria-label={t("notifications.needsAttention")}>
              <h3 className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
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
          ) : (
            <ul>
              {notifications.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onRead={(id) => markOne.mutate(id)}
                />
              ))}
            </ul>
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
    </div>
  )
}
