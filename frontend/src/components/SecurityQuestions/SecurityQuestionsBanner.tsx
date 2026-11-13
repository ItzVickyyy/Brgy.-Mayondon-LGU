import { KeyRound, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { SecurityQuestionsDialog } from "./SecurityQuestionsDialog"
import { useSecurityQuestionsStatus } from "./useSecurityQuestionsStatus"

const dismissKey = (userId: string) => `sq-banner-dismissed:${userId}`

function wasDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(userId)) === "1"
  } catch {
    return false
  }
}

/**
 * A banner above every page until the person has set recovery questions.
 * A System Administrator cannot dismiss it (the questions are the only way
 * back in if the password is forgotten); staff may choose "Not now".
 */
export function SecurityQuestionsBanner() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data } = useSecurityQuestionsStatus(Boolean(user))
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!user || !data || data.configured) return null
  const isAdmin = user.role === "admin" || user.is_superuser === true
  if (!isAdmin && (dismissed || wasDismissed(user.id))) return null

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(user.id), "1")
    } catch {
      // Private browsing: just hide it for this page view.
    }
    setDismissed(true)
  }

  return (
    <div
      role="status"
      data-testid="security-questions-banner"
      className="flex flex-col gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <KeyRound
        className="hidden size-5 shrink-0 sm:block"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1">
        {isAdmin
          ? t("securityQuestions.banner.admin")
          : t("securityQuestions.banner.staff")}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11 sm:min-h-8"
          onClick={() => setOpen(true)}
        >
          {t("securityQuestions.banner.action")}
        </Button>
        {isAdmin ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 gap-1 sm:min-h-8"
            onClick={dismiss}
          >
            <X className="size-4" aria-hidden="true" />
            {t("securityQuestions.banner.dismiss")}
          </Button>
        )}
      </div>
      <SecurityQuestionsDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
