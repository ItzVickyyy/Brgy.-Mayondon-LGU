import { FileText, Printer, ScrollText } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PrintMode } from "@/lib/print/printMode"

const choices = [
  { mode: "data", icon: ScrollText },
  { mode: "form", icon: FileText },
] as const satisfies readonly { mode: PrintMode; icon: unknown }[]

/** Asks how to print an issued document: values only (pre-printed paper) or the form with the values (blank paper). Choosing one prints straight away. */
export function PrintModeDialog({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (mode: PrintMode) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalShell} sm:max-w-md`}>
        <DialogHeader className={modalHeader}>
          <div className="flex items-center gap-3 text-left">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
            >
              <Printer className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-lg leading-tight">
                {t("issuances.history.printDialog.title")}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {t("issuances.history.printDialog.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={`${modalBody} grid gap-3`}>
          {choices.map(({ mode, icon: Icon }) => (
            <Button
              key={mode}
              type="button"
              variant="outline"
              data-testid={`print-mode-${mode}`}
              onClick={() => onChoose(mode)}
              className="h-auto justify-start gap-4 px-4 py-3 text-left whitespace-normal"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold">
                  {t(`issuances.history.printDialog.modes.${mode}.name`)}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {t(`issuances.history.printDialog.modes.${mode}.hint`)}
                </span>
              </span>
            </Button>
          ))}
        </div>
        <div className={`${modalFooter} flex justify-end`}>
          <Button
            type="button"
            variant="outline"
            data-testid="print-mode-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("issuances.history.printDialog.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
