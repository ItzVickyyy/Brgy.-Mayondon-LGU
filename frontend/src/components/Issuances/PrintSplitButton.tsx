import { Check, ChevronDown, Printer } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getPrintMode,
  type PrintMode,
  setPrintMode,
} from "@/lib/print/printMode"

type Props = {
  name: string // resident name, for the accessible labels
  onPrint: (mode: PrintMode) => void
}

/** Print button for an issued row: the main part prints with the remembered mode, the arrow lets staff pick the other one. */
export function PrintSplitButton({ name, onPrint }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<PrintMode>(getPrintMode)

  const choose = (next: PrintMode) => {
    setPrintMode(next)
    setMode(next)
    onPrint(next)
  }

  return (
    <div className="flex items-center">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-r-none"
        aria-label={t("issuances.history.actions.printFor", { name })}
        title={t(
          mode === "form"
            ? "issuances.history.actions.printForm"
            : "issuances.history.actions.printData",
        )}
        onClick={() => onPrint(mode)}
      >
        <Printer aria-hidden="true" />
        {t("issuances.history.actions.print")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="-ml-px min-w-11 rounded-l-none px-2"
            aria-label={t("issuances.history.actions.printChoose", { name })}
          >
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(["data", "form"] as const).map((option) => (
            <DropdownMenuItem key={option} onSelect={() => choose(option)}>
              <Check
                aria-hidden="true"
                className={`size-4 ${mode === option ? "" : "invisible"}`}
              />
              {t(
                option === "form"
                  ? "issuances.history.actions.printForm"
                  : "issuances.history.actions.printData",
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
