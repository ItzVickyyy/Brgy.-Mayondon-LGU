import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { AxiosError } from "axios"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { SecurityQuestionsService, type SecurityQuestionsSet } from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import type { SecurityQuestionId } from "@/lib/securityQuestions"

type Props = {
  email: string
  questionIds: string[]
  onBack: () => void
}

/** Step 2 of /recover-password: three answers and a new password. */
export function RecoveryQuestionsStep({ email, questionIds, onBack }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [answers, setAnswers] = useState<string[]>(questionIds.map(() => ""))
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      SecurityQuestionsService.questionsRecoveryReset({
        body: {
          email,
          new_password: password,
          answers: questionIds.map((id, i) => ({
            question_id: id,
            answer: answers[i],
          })) as SecurityQuestionsSet["answers"],
        },
      }),
    onSuccess: () => {
      showSuccessToast(t("securityQuestions.recovery.success"))
      navigate({ to: "/login" })
    },
    onError: (err: Error) => {
      const status =
        err instanceof AxiosError ? err.response?.status : undefined
      if (status === 429) {
        showErrorToast(t("securityQuestions.recovery.tooMany"))
      } else if (status === 400 || status === 422) {
        // Never say which answer was wrong. 422 is a too-short new password.
        showErrorToast(
          status === 400
            ? t("securityQuestions.recovery.failed")
            : t("password.validation.newMin"),
        )
      } else {
        showErrorToast(t("apiErrors.generic"))
      }
    },
  })

  const answersMissing = answers.some((a) => a.trim().length === 0)
  const passwordShort = password.length < 12
  const mismatch = password !== confirm

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (answersMissing || passwordShort || mismatch || mutation.isPending)
      return
    mutation.mutate()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">
          {t("securityQuestions.recovery.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("securityQuestions.recovery.description", { email })}
        </p>
      </div>

      <div className="grid gap-4">
        {questionIds.map((id, i) => (
          <div key={id} className="grid gap-2">
            <Label htmlFor={`rq-answer-${id}`}>
              {t(`securityQuestions.catalog.${id as SecurityQuestionId}`)}
            </Label>
            <Input
              id={`rq-answer-${id}`}
              data-testid={`recovery-answer-${i}`}
              autoComplete="off"
              maxLength={200}
              placeholder={t("securityQuestions.recovery.answer")}
              value={answers[i]}
              aria-invalid={submitted && answers[i].trim().length === 0}
              onChange={(event) =>
                setAnswers((prev) =>
                  prev.map((v, k) => (k === i ? event.target.value : v)),
                )
              }
            />
          </div>
        ))}
        {submitted && answersMissing ? (
          <p role="alert" className="text-sm text-destructive">
            {t("securityQuestions.dialog.validation.required")}
          </p>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="rq-new-password">
            {t("securityQuestions.recovery.newPassword")}
          </Label>
          <PasswordInput
            id="rq-new-password"
            data-testid="recovery-new-password"
            autoComplete="new-password"
            value={password}
            aria-invalid={submitted && passwordShort}
            onChange={(event) => setPassword(event.target.value)}
          />
          {submitted && passwordShort ? (
            <p role="alert" className="text-sm text-destructive">
              {t("password.validation.newMin")}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rq-confirm-password">
            {t("securityQuestions.recovery.confirmPassword")}
          </Label>
          <PasswordInput
            id="rq-confirm-password"
            data-testid="recovery-confirm-password"
            autoComplete="new-password"
            value={confirm}
            aria-invalid={submitted && mismatch}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {submitted && mismatch ? (
            <p role="alert" className="text-sm text-destructive">
              {t("password.validation.mismatch")}
            </p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("securityQuestions.recovery.noQuestionsHint")}
        </p>

        <LoadingButton
          type="submit"
          className="w-full"
          loading={mutation.isPending}
        >
          {t("securityQuestions.recovery.submit")}
        </LoadingButton>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full"
          onClick={onBack}
        >
          {t("securityQuestions.recovery.back")}
        </Button>
      </div>
    </form>
  )
}
