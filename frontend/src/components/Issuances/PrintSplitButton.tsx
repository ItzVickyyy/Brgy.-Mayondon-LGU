import { Printer } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { type PrintMode, setPrintMode } from "@/lib/print/printMode"

type Props = {
  name: string // resident name, for the accessible labels
  /** A form that is only ever printed on its own blank form image (Residency, Jobseeker): one button, no choice. */
  formOnly?: boolean
  onPrint: (mode: PrintMode) => void
}

/** Print buttons for an issued row: one click prints either "Data only" (pre-printed paper) or "Form + data" (blank paper). */
export function PrintSplitButton({ name, formOnly, onPrint }: Props) {
  const { t } = useTranslation()

  const choose = (mode: PrintMode) => {
    setPrintMode(mode) // the success screen's "Print again" follows the last choice
    onPrint(mode)
  }

  if (formOnly)
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={t("issuances.history.actions.printFor", { name })}
        title={t("issuances.history.actions.printForm")}
        onClick={() => choose("form")}
      >
        <Printer aria-hidden="true" />
        {t("issuances.history.actions.print")}
      </Button>
    )

  return (
    <div className="flex items-center">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-r-none px-2.5"
        aria-label={t("issuances.history.actions.printDataFor", { name })}
        title={t("issuances.history.actions.printData")}
        onClick={() => choose("data")}
      >
        {t("issuances.history.actions.printDataShort")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="-ml-px rounded-l-none px-2.5"
        aria-label={t("issuances.history.actions.printFormFor", { name })}
        title={t("issuances.history.actions.printForm")}
        onClick={() => choose("form")}
      >
        {t("issuances.history.actions.printFormShort")}
      </Button>
    </div>
  )
}
