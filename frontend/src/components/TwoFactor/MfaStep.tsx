import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import useAuth from "@/hooks/useAuth"

type Props = { mfaToken: string; onExpired: () => void }

/** Second step of sign-in: the code from the authenticator app, or a recovery code. */
export function MfaStep({ mfaToken, onExpired }: Props) {
  const { t } = useTranslation()
  const { verifyMfaMutation } = useAuth()
  const [code, setCode] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const error = verifyMfaMutation.error as {
    body?: { detail?: unknown }
    detail?: unknown
  } | null
  const detail = error?.body?.detail ?? error?.detail
  const expired = typeof detail === "string" && detail.includes("expired")
  const message = !error
    ? null
    : expired
      ? t("twoFactor.login.expired")
      : t("twoFactor.login.wrong")

  const submit = () => {
    setSubmitted(true)
    if (!code.trim() || verifyMfaMutation.isPending) return
    verifyMfaMutation.mutate({ mfaToken, code })
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("twoFactor.login.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("twoFactor.login.subtitle")}
        </p>
      </div>

      {message ? (
        <p
          role="alert"
          className="animate-in fade-in-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive duration-200"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="mfa-login-code">
            {t("twoFactor.login.codeLabel")}
          </Label>
          <Input
            id="mfa-login-code"
            data-testid="mfa-code-input"
            autoComplete="one-time-code"
            autoFocus
            maxLength={40}
            className="h-11 font-mono tracking-widest"
            value={code}
            aria-invalid={submitted && !code.trim()}
            onChange={(event) => setCode(event.target.value)}
          />
          {submitted && !code.trim() ? (
            <p className="text-xs text-destructive">
              {t("twoFactor.required")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("twoFactor.login.help")}
          </p>
        </div>
        <LoadingButton
          type="submit"
          className="h-11 w-full"
          loading={verifyMfaMutation.isPending}
        >
          {t("twoFactor.login.submit")}
        </LoadingButton>
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-brand underline-offset-4 hover:underline"
          onClick={onExpired}
        >
          {t("twoFactor.login.back")}
        </button>
      </div>
    </form>
  )
}
