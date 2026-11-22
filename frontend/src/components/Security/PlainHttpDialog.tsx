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
  /** "Remind me later": hides the reminder for a while (kept in this browser). */
  onSnooze: () => void
}

/**
 * Explains, in plain words, why an address that starts with http:// is a risk on the office network
 * and what to ask for (patch 212). It changes nothing by itself: switching HTTPS on is done once on
 * the server computer, and every office computer must then trust the office certificate.
 */
export function PlainHttpDialog({ open, onOpenChange, onSnooze }: Props) {
  const { t } = useTranslation()
  const points = ["listen", "camera", "how"] as const
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${modalShell} sm:max-w-lg`}
        data-testid="plain-http-dialog"
      >
        <DialogHeader className={modalHeader}>
          <DialogTitle>{t("security.plainHttp.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("security.plainHttp.dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className={modalBody}>
          <ul className="grid gap-3 text-sm leading-6">
            {points.map((point) => (
              <li key={point} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-brand"
                />
                <span>{t(`security.plainHttp.dialog.points.${point}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${modalFooter} flex flex-wrap justify-end gap-2`}>
          <Button
            type="button"
            variant="outline"
            data-testid="plain-http-snooze"
            onClick={() => {
              onSnooze()
              onOpenChange(false)
            }}
          >
            {t("security.plainHttp.dialog.later")}
          </Button>
          <Button
            type="button"
            data-testid="plain-http-close"
            onClick={() => onOpenChange(false)}
          >
            {t("security.plainHttp.dialog.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
