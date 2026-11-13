import { useMutation, useQueryClient } from "@tanstack/react-query"
import QRCode from "qrcode"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { type MfaSetup, TwoFactorService } from "@/client"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { getLocale } from "@/lib/locale"
import { handleError } from "@/utils"
import { RecoveryCodesList } from "./RecoveryCodesList"
import { MFA_STATUS_KEY } from "./useMfaStatus"

type Props = { open: boolean; onOpenChange: (open: boolean) => void }
type Step = "password" | "scan" | "codes"

const CLOCK_WARNING_MS = 90_000

const groupSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim()

/** Turn two-factor on: password, scan the QR code and type a code, save codes. */
export function TwoFactorSetupDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [setup, setSetup] = useState<MfaSetup | null>(null)
  const [qr, setQr] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep("password")
      setPassword("")
      setCode("")
      setSetup(null)
      setQr("")
      setCodes([])
      setSaved(false)
      setSubmitted(false)
    }
  }, [open])

  // The QR code is drawn here in the browser: nothing is sent to any website.
  useEffect(() => {
    if (!setup) return
    let cancelled = false
    QRCode.toDataURL(setup.otpauth_uri, { margin: 2, width: 220 })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        if (!cancelled) setQr("")
      })
    return () => {
      cancelled = true
    }
  }, [setup])

  const start = useMutation({
    mutationFn: () =>
      TwoFactorService.factorStartMfaSetup({
        body: { current_password: password },
      }),
    onSuccess: (response) => {
      setSetup(response.data)
      setCode("")
      setSubmitted(false)
      setStep("scan")
    },
    onError: handleError.bind(showErrorToast),
  })

  const enable = useMutation({
    mutationFn: () => TwoFactorService.factorEnableMfa({ body: { code } }),
    onSuccess: (response) => {
      setCodes(response.data.recovery_codes)
      setStep("codes")
      showSuccessToast(t("twoFactor.setup.enabled"))
      queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY })
    },
    onError: handleError.bind(showErrorToast),
  })

  const clockOffset = setup
    ? Math.abs(Date.now() - new Date(setup.server_time).getTime())
    : 0
  const serverTime = setup
    ? new Intl.DateTimeFormat(getLocale(), {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(setup.server_time))
    : ""

  const handleOpenChange = (next: boolean) => {
    // The recovery codes are shown only once: do not close before they are saved.
    if (!next && step === "codes" && !saved) return
    onOpenChange(next)
  }

  const submitPassword = () => {
    setSubmitted(true)
    if (!password || start.isPending) return
    start.mutate()
  }
  const submitCode = () => {
    setSubmitted(true)
    if (!code.trim() || enable.isPending) return
    enable.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`${modalShell} sm:max-w-lg`}>
        <DialogHeader className={modalHeader}>
          <DialogTitle>{t(`twoFactor.setup.${step}Title`)}</DialogTitle>
          <DialogDescription>
            {t(`twoFactor.setup.${step}Description`)}
          </DialogDescription>
        </DialogHeader>

        <div className={`${modalBody} grid gap-4`}>
          {step === "password" ? (
            <div className="grid gap-2">
              <Label htmlFor="mfa-setup-password">
                {t("twoFactor.currentPassword")}
              </Label>
              <PasswordInput
                id="mfa-setup-password"
                autoComplete="current-password"
                value={password}
                aria-invalid={submitted && !password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitPassword()
                }}
              />
              {submitted && !password ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("twoFactor.required")}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "scan" && setup ? (
            <>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                {qr ? (
                  <img
                    src={qr}
                    alt={t("twoFactor.setup.qrAlt")}
                    width={220}
                    height={220}
                    className="rounded-lg border bg-white"
                    data-testid="mfa-qr"
                  />
                ) : (
                  <div className="size-[220px] rounded-lg border bg-muted" />
                )}
                <div className="grid min-w-0 gap-1">
                  <p className="text-sm text-muted-foreground">
                    {t("twoFactor.setup.cannotScan")}
                  </p>
                  <p
                    className="break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm tracking-wider"
                    data-testid="mfa-secret"
                  >
                    {groupSecret(setup.secret)}
                  </p>
                </div>
              </div>
              <p className="text-sm" data-testid="mfa-server-time">
                {t("twoFactor.setup.serverTime", { time: serverTime })}
              </p>
              {clockOffset > CLOCK_WARNING_MS ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {t("twoFactor.setup.clockWarning", {
                    minutes: Math.max(1, Math.round(clockOffset / 60_000)),
                  })}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="mfa-setup-code">
                  {t("twoFactor.setup.codeLabel")}
                </Label>
                <Input
                  id="mfa-setup-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  className="h-11 font-mono tracking-widest"
                  value={code}
                  aria-invalid={submitted && !code.trim()}
                  onChange={(event) => setCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitCode()
                  }}
                />
                {submitted && !code.trim() ? (
                  <p role="alert" className="text-sm text-destructive">
                    {t("twoFactor.required")}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {step === "codes" ? (
            <>
              <RecoveryCodesList codes={codes} />
              <div className="flex items-start gap-3">
                <Checkbox
                  id="mfa-codes-saved"
                  checked={saved}
                  onCheckedChange={(value) => setSaved(value === true)}
                />
                <Label
                  htmlFor="mfa-codes-saved"
                  className="text-sm font-normal leading-snug"
                >
                  {t("twoFactor.codes.savedConfirm")}
                </Label>
              </div>
            </>
          ) : null}
        </div>

        <div
          className={`${modalFooter} flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`}
        >
          {step !== "codes" ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={() => onOpenChange(false)}
            >
              {t("twoFactor.cancel")}
            </Button>
          ) : null}
          {step === "password" ? (
            <LoadingButton
              type="button"
              className="min-h-11 sm:min-h-9"
              loading={start.isPending}
              onClick={submitPassword}
            >
              {t("twoFactor.setup.next")}
            </LoadingButton>
          ) : null}
          {step === "scan" ? (
            <LoadingButton
              type="button"
              className="min-h-11 sm:min-h-9"
              loading={enable.isPending}
              onClick={submitCode}
            >
              {t("twoFactor.setup.turnOn")}
            </LoadingButton>
          ) : null}
          {step === "codes" ? (
            <Button
              type="button"
              className="min-h-11 sm:min-h-9"
              disabled={!saved}
              onClick={() => onOpenChange(false)}
            >
              {t("twoFactor.codes.done")}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
