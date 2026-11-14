import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { BackupsService } from "@/client"
import { useSecurityQuestionsStatus } from "@/components/SecurityQuestions/useSecurityQuestionsStatus"
import { useMfaStatus } from "@/components/TwoFactor/useMfaStatus"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

/**
 * How soon it needs doing. The dot on the bell takes the colour of the most
 * urgent open reminder: urgent = red, soon = orange, optional = green.
 */
export type ReminderSeverity = "urgent" | "soon" | "optional"

export const SEVERITY_ORDER: ReminderSeverity[] = ["urgent", "soon", "optional"]

export type SetupReminder = {
  id: "securityQuestions" | "twoFactor" | "backupTool"
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

  return reminders.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
}
