import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  reason?: "none" | "optional" | "required"
  onConfirm: (reasonText: string) => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  reason = "none",
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [reasonText, setReasonText] = useState("")

  useEffect(() => {
    if (!open) setReasonText("")
  }, [open])

  const needsReason = reason === "required"
  const canConfirm = !needsReason || reasonText.trim().length >= 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {reason !== "none" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="confirm-reason" className="text-sm font-medium">
              {t("common.confirm.reason")} {needsReason ? `(${t("common.confirm.required")})` : `(${t("common.confirm.optional")})`}
            </label>
            <textarea
              id="confirm-reason"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              rows={3}
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder={t("common.confirm.placeholder")}
              required={needsReason}
              aria-describedby={needsReason ? "confirm-reason-help" : undefined}
            />
            {needsReason && reasonText.trim().length > 0 && reasonText.trim().length < 3 ? (
              <p id="confirm-reason-help" className="text-xs text-destructive">{t("common.confirm.minReason")}</p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? t("common.confirm.cancel")}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return
              onConfirm(reasonText.trim())
              onOpenChange(false)
            }}
          >
            {confirmLabel ?? t("common.confirm.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
