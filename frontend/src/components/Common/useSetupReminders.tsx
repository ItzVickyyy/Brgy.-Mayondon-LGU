import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { BackupsService } from "@/client"
import { useDataProtection } from "@/components/Security/useDataProtection"
import { useSecurityQuestionsStatus } from "@/components/SecurityQuestions/useSecurityQuestionsStatus"
import { useMfaStatus } from "@/components/TwoFactor/useMfaStatus"
import { useUpdateStatus } from "@/components/Updates/useUpdateStatus"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

/**
 * How soon it needs doing. The dot on the bell takes the colour of the most
 * urgent open reminder: urgent = red, soon = orange, optional = green.
 */
export type ReminderSeverity = "urgent" | "soon" | "optional"

export const SEVERITY_ORDER: ReminderSeverity[] = ["urgent", "soon", "optional"]

export type SetupReminder = {
  id:
    | "securityQuestions"
    | "twoFactor"
    | "backupTool"
    | "update"
    | "plainHttp"
    | "dataKey"
    | "secondAdmin"
  testId: string
  severity: ReminderSeverity
  /** A short heading (only when the text below is a longer instruction). */
  title?: string
  /** The full text shown in the notification list. */
  text: ReactNode
  /** A few words, shown in the looping bubble next to the bell. */
  teaser: string
  action: string
  /** Where the button goes, for a reminder that has no dialog. */
  to?: string
  dismissLabel?: string
  onDismiss?: () => void
}

const dismissKey = (userId: string) => `sq-banner-dismissed:${userId}`

const httpSnoozeKey = (userId: string) => `https-reminder-snoozed:${userId}`
/** "Remind me later" on the plain-HTTP reminder hides it this long. */
export const HTTP_SNOOZE_DAYS = 14
export const HTTP_SNOOZE_EVENT = "https-reminder-snoozed"

/**
 * True when the program was opened over plain http:// from another computer. On the server
 * computer itself (localhost) nothing crosses the network, so it is not a risk there.
 */
export function isPlainHttpOnNetwork(
  loc: { protocol: string; hostname: string } = window.location,
): boolean {
  if (loc.protocol !== "http:") return false
  return !["localhost", "127.0.0.1", "[::1]", "::1"].includes(loc.hostname)
}

export function isHttpReminderSnoozed(
  userId: string,
  now = Date.now(),
): boolean {
  try {
    const until = Number(localStorage.getItem(httpSnoozeKey(userId)))
    return Number.isFinite(until) && until > now
  } catch {
    return false
  }
}

export function snoozeHttpReminder(userId: string, now = Date.now()): void {
  try {
    localStorage.setItem(
      httpSnoozeKey(userId),
      String(now + HTTP_SNOOZE_DAYS * 24 * 60 * 60 * 1000),
    )
  } catch {
    // Private browsing: it simply comes back on the next page view.
  }
  window.dispatchEvent(new Event(HTTP_SNOOZE_EVENT))
}

function wasDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(userId)) === "1"
  } catch {
    return false
  }
}

/**
 * The two "finish setting up your account" reminders that used to be banners
 * above every page: recovery questions, and two-factor sign-in. They now live
 * in the notification bell. The rules are the same as the banners had:
 * - Recovery questions: shown until they are set. A System Administrator
 *   cannot dismiss it; staff may choose "Not now" (remembered in
 *   `sq-banner-dismissed:<userId>`).
 * - Two-factor: shown while it is off, for a System Administrator (always)
 *   and for a staff member an administrator asked. No "Not now".
 * - Backup tool missing: System Administrator only (moved here from the top of
 *   the Backup and Restore page).
 * - New version ready (patch 206): System Administrator only, and only on a computer whose
 *   update service is running. The computer installs it by itself at night; the button
 *   (an `UpdateDialog`) installs it now.
 * - Plain HTTP (patch 212): System Administrator only, while the page was opened over
 *   `http://` from another computer (not `localhost`). "Remind me later" hides it for 14 days.
 * - Health-condition key (patch 214): System Administrator only. Red when saved values cannot be
 *   opened with the key on this computer, orange when no key is set (they are stored as plain
 *   text). No "remind me later": it is fixed once, on the server computer.
 * Severity: two-factor and the missing backup tool are urgent (red); recovery
 * questions an administrator cannot dismiss are soon (orange); recovery
 * questions staff may postpone are optional (green).
 */
export function useSetupReminders(): SetupReminder[] {
  const { t } = useTranslation()
  const { user } = useAuth()
  const questions = useSecurityQuestionsStatus(Boolean(user))
  const mfa = useMfaStatus(Boolean(user))
  const [dismissed, setDismissed] = useState(false)
  const isAdmin = Boolean(user) && isSystemAdministrator(user)
  // Same query as the Backup and Restore page, so it is fetched once.
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: async () => (await BackupsService.listBackups()).data,
    enabled: isAdmin,
    staleTime: 60_000,
  })

  const update = useUpdateStatus(isAdmin)
  const protection = useDataProtection(isAdmin)
  // Re-read the "remind me later" time when the dialog sets it.
  const [, setSnoozeTick] = useState(0)
  useEffect(() => {
    const bump = () => setSnoozeTick((n) => n + 1)
    window.addEventListener(HTTP_SNOOZE_EVENT, bump)
    return () => window.removeEventListener(HTTP_SNOOZE_EVENT, bump)
  }, [])

  if (!user) return []
  const reminders: SetupReminder[] = []

  const questionsData = questions.data
  if (
    questionsData &&
    !questionsData.configured &&
    (isAdmin || !(dismissed || wasDismissed(user.id)))
  ) {
    reminders.push({
      id: "securityQuestions",
      testId: "security-questions-banner",
      severity: isAdmin ? "soon" : "optional",
      text: isAdmin
        ? t("securityQuestions.banner.admin")
        : t("securityQuestions.banner.staff"),
      teaser: t("notifications.teaser.securityQuestions"),
      action: t("securityQuestions.banner.action"),
      dismissLabel: isAdmin ? undefined : t("securityQuestions.banner.dismiss"),
      onDismiss: isAdmin
        ? undefined
        : () => {
            try {
              localStorage.setItem(dismissKey(user.id), "1")
            } catch {
              // Private browsing: just hide it for this page view.
            }
            setDismissed(true)
          },
    })
  }

  const mfaData = mfa.data
  if (
    mfaData?.available === true &&
    mfaData.enabled === false &&
    (isAdmin || mfaData.required === true)
  ) {
    reminders.push({
      id: "twoFactor",
      testId: "two-factor-banner",
      severity: "urgent",
      text: isAdmin ? t("twoFactor.banner.admin") : t("twoFactor.banner.staff"),
      teaser: t("notifications.teaser.twoFactor"),
      action: t("twoFactor.banner.action"),
    })
  }

  if (isAdmin && backups.data && backups.data.tool_available === false) {
    reminders.push({
      id: "backupTool",
      testId: "backup-tool-reminder",
      severity: "urgent",
      title: t("admin.backup.unavailable.title"),
      text: (
        <Trans
          i18nKey="admin.backup.unavailable.howTo"
          values={{ command: ".\\scripts\\backup-db.ps1", folder: "backups" }}
          components={{ code: <code className="font-mono" /> }}
        />
      ),
      teaser: t("notifications.teaser.backupTool"),
      action: t("notifications.openBackup"),
      to: "/backup-restore",
    })
  }

  const updateData = update.data
  if (
    isAdmin &&
    updateData?.watcher_running &&
    (updateData.state === "available" ||
      updateData.state === "updating" ||
      updateData.requested)
  ) {
    const running = updateData.state === "updating" || updateData.requested
    reminders.push({
      id: "update",
      testId: "update-reminder",
      severity: "soon",
      title: running
        ? t("update.reminder.runningTitle")
        : t("update.reminder.title"),
      text: running
        ? t("update.reminder.runningText")
        : t("update.reminder.text"),
      teaser: t("notifications.teaser.update"),
      action: running
        ? t("update.reminder.viewProgress")
        : t("update.reminder.action"),
    })
  }

  if (isAdmin && isPlainHttpOnNetwork() && !isHttpReminderSnoozed(user.id)) {
    reminders.push({
      id: "plainHttp",
      testId: "plain-http-reminder",
      severity: "soon",
      title: t("security.plainHttp.title"),
      text: t("security.plainHttp.text"),
      teaser: t("notifications.teaser.plainHttp"),
      action: t("security.plainHttp.action"),
    })
  }

  const protectionData = protection.data
  if (isAdmin && protectionData) {
    const unreadable = protectionData.unreadable_count > 0
    if (unreadable || !protectionData.key_configured) {
      const kind = unreadable ? "unreadable" : "missing"
      reminders.push({
        id: "dataKey",
        testId: "data-key-reminder",
        severity: unreadable ? "urgent" : "soon",
        title: t(`security.dataKey.${kind}.title`),
        text: t(`security.dataKey.${kind}.text`, {
          count: protectionData.unreadable_count,
        }),
        teaser: t(`security.dataKey.${kind}.teaser`),
        action: t("security.dataKey.action"),
      })
    }
  }

  if (isAdmin && protectionData?.active_admin_count === 1) {
    reminders.push({
      id: "secondAdmin",
      testId: "second-admin-reminder",
      severity: "soon",
      title: t("security.secondAdmin.title"),
      text: t("security.secondAdmin.text"),
      teaser: t("notifications.teaser.secondAdmin"),
      action: t("security.secondAdmin.action"),
      to: "/admin",
    })
  }

  return reminders.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
}
