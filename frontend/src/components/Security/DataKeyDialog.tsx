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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** missing = no key in .env; unreadable = a key is set but cannot open the saved values. */
  kind: "missing" | "unreadable"
  count: number
}

/**
 * Plain-words steps for the data-key reminder (patch 214). It changes nothing by itself: the key
 * lives in `.env` on the server computer, so the fix is done there by whoever looks after it.
 */
export function DataKeyDialog({ open, onOpenChange, kind, count }: Props) {
  const { t } = useTranslation()
  const steps = ["one", "two", "three"] as const
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${modalShell} sm:max-w-lg`}
        data-testid="data-key-dialog"
      >
        <DialogHeader className={modalHeader}>
          <DialogTitle>
            {t(`security.dataKey.${kind}.dialog.title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`security.dataKey.${kind}.dialog.description`, { count })}
          </DialogDescription>
        </DialogHeader>
        <div className={modalBody}>
          <ol className="grid gap-3 text-sm leading-6">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white"
                >
                  {index + 1}
                </span>
                <span className="break-words">
                  {t(`security.dataKey.${kind}.dialog.steps.${step}`)}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className={`${modalFooter} flex justify-end`}>
          <Button
            type="button"
            data-testid="data-key-close"
            onClick={() => onOpenChange(false)}
          >
            {t("security.dataKey.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
