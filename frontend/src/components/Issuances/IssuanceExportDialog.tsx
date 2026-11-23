import { Download, FileText, FileType } from "lucide-react"
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
import type { ExportFormat } from "@/lib/print/exportDocument"

const choices = [
  { format: "docx", icon: FileText },
  { format: "pdf", icon: FileType },
] as const satisfies readonly { format: ExportFormat; icon: unknown }[]

/** Asks which file type to save an issued document as. Choosing one saves it straight away (same layout as the Management Reports export). */
export function IssuanceExportDialog({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (format: ExportFormat) => void
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
              <Download className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-lg leading-tight">
                {t("issuances.history.exportDialog.title")}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {t("issuances.history.exportDialog.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={`${modalBody} grid gap-3`}>
          {choices.map(({ format, icon: Icon }) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              data-testid={`issuance-export-${format}`}
              onClick={() => onChoose(format)}
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
                  {t(`issuances.history.exportDialog.formats.${format}.name`)}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {t(`issuances.history.exportDialog.formats.${format}.hint`)}
                </span>
              </span>
            </Button>
          ))}
        </div>
        <div className={`${modalFooter} flex justify-end`}>
          <Button
            type="button"
            variant="outline"
            data-testid="issuance-export-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("issuances.history.exportDialog.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
