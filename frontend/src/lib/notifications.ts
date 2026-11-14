import { toast } from "sonner"

import type { NotificationItem } from "@/client"
import i18n from "@/i18n"

// The bell in the top bar is fed by the server (the audit log, filtered by
// role, with read state kept per person): see `components/Common/
// NotificationBell.tsx`. Nothing is stored in this browser any more.
//
// `notify()` is only the on-screen toast that pages show while they act. It is
// kept under this name so the existing page calls keep working.

export type NotificationInput =
  | string
  // A translation key follows a language switch; plain text does not.
  | { key: string; values?: Record<string, string | number> }

type Translate = (key: string, values?: object) => string

// Keys come from the server's action names, so they bypass the typed key list.
const translate = (): Translate => i18n.t as unknown as Translate

function noticeText(input: NotificationInput): string {
  if (typeof input === "string") return input
  return translate()(input.key, input.values)
}

/** Shows a toast. `toastText`, when given, is what the toast says. */
export function notify(
  input: NotificationInput,
  tone: "success" | "warning" = "success",
  options?: { toastText?: string },
) {
  const text = options?.toastText ?? noticeText(input)
  if (tone === "warning") toast.warning(text)
  else toast.success(text)
}

/**
 * The sentence for one bell notice, in the language in use now. The server
 * sends only the action, who did it and to whom; the words are built here, so
 * they follow a language switch. Wording variants, tried in this order:
 * `<action>__failed` (when the outcome is not a success), `<action>__me` (the
 * notice is about your own account), `<action>__self` (you did it to yourself).
 */
export function noticeSentence(item: NotificationItem): string {
  const t = translate()
  const base = `notifications.events.${item.action.replace(/\./g, "_")}`
  const actor = item.actor_is_me
    ? t("notifications.you")
    : (item.actor_name ?? t("notifications.removedActor"))
  const target = item.target_is_me
    ? t("notifications.you")
    : (item.target_name ?? t("notifications.removedTarget"))
  const values = { actor, target }
  const candidates: string[] = []
  if (item.outcome !== "success") {
    if (i18n.exists(`${base}__failed`)) return t(`${base}__failed`, values)
    // A lock-out is recorded as "failed" and its sentence already says so.
    if (item.action !== "auth.account_locked")
      return t("notifications.eventFailed", values)
  }
  if (item.target_is_me) candidates.push(`${base}__me`)
  if (item.actor_is_me) candidates.push(`${base}__self`)
  candidates.push(base)
  for (const key of candidates) {
    if (i18n.exists(key)) return t(key, values)
  }
  return t("notifications.eventFailed", values)
}
