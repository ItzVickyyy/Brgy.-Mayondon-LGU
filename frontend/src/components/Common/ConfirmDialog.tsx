import { useEffect, useState } from "react"

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
  destructive?: boolean
  reason?: "none" | "optional" | "required"
  onConfirm: (reasonText: string) => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  reason = "none",
  onConfirm,
}: ConfirmDialogProps) {
  const [reasonText, setReasonText] = useState("")

  useEffect(() => {
    if (!open) setReasonText("")
  }, [open])

  const needsReason = reason === "required"
  const canConfirm = !needsReason || reasonText.trim().length > 0

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
              Reason {needsReason ? "(required)" : "(optional)"}
            </label>
            <textarea
              id="confirm-reason"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              rows={3}
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Enter a reason"
              required={needsReason}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
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
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
