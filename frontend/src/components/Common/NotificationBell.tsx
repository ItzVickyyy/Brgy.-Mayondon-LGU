import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Bell, BellOff, Check, CheckCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { type NotificationItem, NotificationsService } from "@/client"
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

  const label =
    unreadCount > 0
      ? t("notifications.bellUnread", { count: unreadCount })
      : t("notifications.bell")

  return (
    <DropdownMenu
      onOpenChange={(open) => {
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
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
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
          <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
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
  )
}
