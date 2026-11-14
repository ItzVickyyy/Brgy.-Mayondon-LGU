import { useState } from "react"
import { useTranslation } from "react-i18next"

import { useSecurityQuestionsStatus } from "@/components/SecurityQuestions/useSecurityQuestionsStatus"
import { useMfaStatus } from "@/components/TwoFactor/useMfaStatus"
import useAuth from "@/hooks/useAuth"

export type SetupReminder = {
  id: "securityQuestions" | "twoFactor"
  testId: string
  /** The full sentence shown in the notification list. */
  text: string
  /** A few words, shown in the looping bubble next to the bell. */
  teaser: string
  action: string
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
 */
export function useSetupReminders(): SetupReminder[] {
  const { t } = useTranslation()
  const { user } = useAuth()
  const questions = useSecurityQuestionsStatus(Boolean(user))
  const mfa = useMfaStatus(Boolean(user))
  const [dismissed, setDismissed] = useState(false)

  if (!user) return []
  const isAdmin = user.role === "admin" || user.is_superuser === true
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
      text: isAdmin ? t("twoFactor.banner.admin") : t("twoFactor.banner.staff"),
      teaser: t("notifications.teaser.twoFactor"),
      action: t("twoFactor.banner.action"),
    })
  }

  return reminders
}
