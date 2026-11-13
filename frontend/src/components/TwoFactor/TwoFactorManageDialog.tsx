import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { TwoFactorService } from "@/client"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { RecoveryCodesList } from "./RecoveryCodesList"
import { MFA_STATUS_KEY } from "./useMfaStatus"

export type ManageMode = "disable" | "codes"

type Props = {
  mode: ManageMode | null
  onOpenChange: (open: boolean) => void
}

/** Turn two-factor off, or make ten new recovery codes. Both need the
 *  password and one valid code (from the app, or a recovery code). */
export function TwoFactorManageDialog({ mode, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)
  const open = mode !== null

  useEffect(() => {
    if (!open) {
      setPassword("")
      setCode("")
      setSubmitted(false)
      setNewCodes(null)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { current_password: password, code }
      if (mode === "disable") {
        await TwoFactorService.factorDisableMfa({ body })
        return null
      }
      return (await TwoFactorService.factorNewMyRecoveryCodes({ body })).data
        .recovery_codes
    },
    onSuccess: (codes) => {
      queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY })
      if (codes) {
        setNewCodes(codes)
        showSuccessToast(t("twoFactor.manage.codesMade"))
      } else {
        showSuccessToast(t("twoFactor.manage.turnedOff"))
        onOpenChange(false)
      }
    },
    onError: handleError.bind(showErrorToast),
  })

  const submit = () => {
    setSubmitted(true)
    if (!password || !code.trim() || mutation.isPending) return
    mutation.mutate()
  }

  const key = mode ?? "disable"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalShell} sm:max-w-md`}>
        <DialogHeader className={modalHeader}>
          <DialogTitle>
            {newCodes
              ? t("twoFactor.manage.newCodesTitle")
              : t(`twoFactor.manage.${key}Title`)}
          </DialogTitle>
          <DialogDescription>
            {newCodes
              ? t("twoFactor.manage.newCodesDescription")
              : t(`twoFactor.manage.${key}Description`)}
          </DialogDescription>
        </DialogHeader>
        <div className={`${modalBody} grid gap-4`}>
          {newCodes ? (
            <RecoveryCodesList codes={newCodes} />
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="mfa-manage-password">
                  {t("twoFactor.currentPassword")}
                </Label>
                <PasswordInput
                  id="mfa-manage-password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={submitted && !password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mfa-manage-code">
                  {t("twoFactor.manage.codeLabel")}
                </Label>
                <Input
                  id="mfa-manage-code"
                  autoComplete="one-time-code"
                  maxLength={40}
                  className="h-11 font-mono tracking-widest"
                  value={code}
                  aria-invalid={submitted && !code.trim()}
                  onChange={(event) => setCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submit()
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t("twoFactor.manage.codeHelp")}
                </p>
              </div>
              {submitted && (!password || !code.trim()) ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("twoFactor.required")}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div
          className={`${modalFooter} flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`}
        >
          {newCodes ? (
            <Button
              type="button"
              className="min-h-11 sm:min-h-9"
              onClick={() => onOpenChange(false)}
            >
              {t("twoFactor.codes.done")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:min-h-9"
                onClick={() => onOpenChange(false)}
              >
                {t("twoFactor.cancel")}
              </Button>
              <LoadingButton
                type="button"
                variant={mode === "disable" ? "destructive" : "default"}
                className="min-h-11 sm:min-h-9"
                loading={mutation.isPending}
                onClick={submit}
              >
                {t(`twoFactor.manage.${key}Confirm`)}
              </LoadingButton>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
