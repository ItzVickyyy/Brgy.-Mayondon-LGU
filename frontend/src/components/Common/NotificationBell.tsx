import { Bell, BellOff, Check, CheckCheck, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getLocale } from "@/lib/locale"
import {
  clearNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  notificationText,
  useNotifications,
} from "@/lib/notifications"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function timeAgo(createdAt: number, now: number): string {
  const formatter = new Intl.RelativeTimeFormat(getLocale(), {
    numeric: "auto",
  })
  const age = Math.max(0, now - createdAt)
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

function NotificationRow({ item }: { item: NotificationItem }) {
  const now = useNow()
  const { t } = useTranslation()
  const text = notificationText(item)
  return (
    <li
      data-testid="notification-item"
      data-read={item.read ? "true" : "false"}
      className={`flex items-start gap-3 border-b px-3 py-3 last:border-b-0 ${
        item.read ? "" : "bg-brand/5"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          item.read ? "bg-transparent" : "bg-brand"
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
          {text}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {timeAgo(item.createdAt, now)}
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
          onClick={() => markNotificationRead(item.id)}
        >
          <Check className="size-4" aria-hidden="true" />
        </Button>
      )}
    </li>
  )
}

export function NotificationBell({ ownerId }: { ownerId: string }) {
  const { t } = useTranslation()
  const { notifications, unreadCount } = useNotifications(ownerId)
  const label =
    unreadCount > 0
      ? t("notifications.bellUnread", { count: unreadCount })
      : t("notifications.bell")

  return (
    <DropdownMenu>
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
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={unreadCount === 0}
              aria-label={t("notifications.markAllRead")}
              title={t("notifications.markAllRead")}
              onClick={markAllNotificationsRead}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={notifications.length === 0}
              aria-label={t("notifications.clearAll")}
              title={t("notifications.clearAll")}
              onClick={clearNotifications}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
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
              {t("notifications.emptyHint")}
            </p>
          </div>
        ) : (
          <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {notifications.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
