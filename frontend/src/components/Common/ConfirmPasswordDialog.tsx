import { useMutation } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { KeyRound } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { LoginService } from "@/client"
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
import { PasswordInput } from "@/components/ui/password-input"

export type ConfirmScope = "backup.restore" | "backup.download"

/** The header the server reads (`X-Confirm-Token`) for a Restore or a Download copy. */
export const confirmHeaders = (token: string) => ({
  "X-Confirm-Token": token,
})

/** The server's message for a failed password check, or `fallback`. */
export function messageOf(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)
      ?.detail
    if (typeof detail === "string") return detail
  }
  return fallback
}

/**
 * Asks the signed-in person to type their password again before a risky
 * action (restoring a backup, downloading a copy of the database). A right
 * password gives a two-minute token for that one action, handed to
 * `onConfirmed`; a wrong one stays in the box area as a message and counts
 * toward the same lock-out as signing in. The password is never kept.
 */
export function ConfirmPasswordDialog({
  open,
  scope,
  description,
  onConfirmed,
  onCancel,
}: {
  open: boolean
  scope: ConfirmScope
  description: string
  onConfirmed: (token: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  // A fresh box every time it opens, so a typed password never lingers.
  useEffect(() => {
    if (open) {
      setPassword("")
      setError("")
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: async () =>
      (await LoginService.confirmPassword({ body: { password, scope } })).data,
    onSuccess: (result) => {
      setPassword("")
      onConfirmed(result.confirm_token)
    },
    onError: (err: Error) => {
      setPassword("")
      setError(messageOf(err, t("common.confirmPassword.failed")))
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (password && !mutation.isPending) {
      setError("")
      mutation.mutate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        className={`${modalShell} sm:max-w-md`}
        data-testid="confirm-password-dialog"
      >
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className={modalHeader}>
            <div className="flex items-center gap-3 text-left">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
              >
                <KeyRound className="size-5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <DialogTitle className="text-lg leading-tight">
                  {t("common.confirmPassword.title")}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className={`${modalBody} grid gap-2`}>
            <label
              htmlFor="confirm-password-input"
              className="text-sm font-medium"
            >
              {t("common.confirmPassword.label")}
            </label>
            <PasswordInput
              id="confirm-password-input"
              data-testid="confirm-password-input"
              autoComplete="current-password"
              autoFocus
              value={password}
              error={error}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p
              role="alert"
              data-testid="confirm-password-error"
              className="min-h-5 text-sm text-destructive"
            >
              {error}
            </p>
          </div>
          <div className={`${modalFooter} flex justify-end gap-2`}>
            <Button
              type="button"
              variant="outline"
              data-testid="confirm-password-cancel"
              onClick={onCancel}
            >
              {t("common.confirmPassword.cancel")}
            </Button>
            <Button
              type="submit"
              data-testid="confirm-password-submit"
              disabled={!password || mutation.isPending}
            >
              {t("common.confirmPassword.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
