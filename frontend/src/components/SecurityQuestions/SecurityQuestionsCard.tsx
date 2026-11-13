import { KeyRound } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { getLocale } from "@/lib/locale"
import { SecurityQuestionsDialog } from "./SecurityQuestionsDialog"
import { useSecurityQuestionsStatus } from "./useSecurityQuestionsStatus"

/** The "Password recovery questions" card in My Account. */
export function SecurityQuestionsCard() {
  const { t } = useTranslation()
  const { data } = useSecurityQuestionsStatus()
  const [open, setOpen] = useState(false)
  const configured = data?.configured === true
  const date = data?.updated_at
    ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
        new Date(data.updated_at),
      )
    : ""

  return (
    <div className="mt-4 rounded-xl border p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <KeyRound className="size-5" />
        </span>
        <div>
          <h4 className="text-sm font-semibold">
            {t("securityQuestions.title")}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("securityQuestions.cardDescription")}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className="text-sm"
          data-testid="security-questions-status"
          data-configured={configured ? "true" : "false"}
        >
          {configured
            ? t("securityQuestions.statusSet", { date })
            : t("securityQuestions.statusNotSet")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-9"
          onClick={() => setOpen(true)}
        >
          {configured
            ? t("securityQuestions.change")
            : t("securityQuestions.setUp")}
        </Button>
      </div>
      <SecurityQuestionsDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
