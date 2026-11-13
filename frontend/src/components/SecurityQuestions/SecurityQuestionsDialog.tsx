import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { SecurityQuestionsService, type SecurityQuestionsSet } from "@/client"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Select } from "@/components/Common/Select"
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
import {
  SECURITY_QUESTION_IDS,
  SECURITY_QUESTIONS_REQUIRED,
  type SecurityQuestionId,
} from "@/lib/securityQuestions"
import { handleError } from "@/utils"
import { SECURITY_QUESTIONS_KEY } from "./useSecurityQuestionsStatus"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const slots = Array.from({ length: SECURITY_QUESTIONS_REQUIRED }, (_, i) => i)

// Same idea as the server: lower case, accents and punctuation ignored.
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

export function SecurityQuestionsDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [ids, setIds] = useState<string[]>(slots.map(() => ""))
  const [answers, setAnswers] = useState<string[]>(slots.map(() => ""))
  const [password, setPassword] = useState("")
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) {
      setIds(slots.map(() => ""))
      setAnswers(slots.map(() => ""))
      setPassword("")
      setSubmitted(false)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () =>
      SecurityQuestionsService.questionsSetMySecurityQuestions({
        body: {
          current_password: password,
          answers: slots.map((i) => ({
            question_id: ids[i],
            answer: answers[i],
          })) as SecurityQuestionsSet["answers"],
        },
      }),
    onSuccess: () => {
      showSuccessToast(t("securityQuestions.dialog.saved"))
      queryClient.invalidateQueries({ queryKey: SECURITY_QUESTIONS_KEY })
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  const normalized = answers.map(normalize)
  const errors = {
    questions: ids.some((id) => !id),
    answerRequired: normalized.some((a) => a.length === 0),
    answerMin: normalized.some((a) => a.length > 0 && a.length < 2),
    answerDistinct:
      normalized.every((a) => a.length >= 2) &&
      new Set(normalized).size !== normalized.length,
    password: password.length === 0,
  }
  const hasError = Object.values(errors).some(Boolean)

  const submit = () => {
    setSubmitted(true)
    if (hasError || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalShell} sm:max-w-xl`}>
        <DialogHeader className={modalHeader}>
          <DialogTitle>{t("securityQuestions.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("securityQuestions.dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className={`${modalBody} grid gap-5`}>
          {slots.map((i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3">
              <Label id={`sq-question-label-${i}`}>
                {t("securityQuestions.dialog.question", { n: i + 1 })}
              </Label>
              <Select
                aria-labelledby={`sq-question-label-${i}`}
                value={ids[i]}
                placeholder={t("securityQuestions.dialog.choose")}
                searchable={false}
                onChange={(event) =>
                  setIds((prev) =>
                    prev.map((v, k) => (k === i ? event.target.value : v)),
                  )
                }
              >
                {SECURITY_QUESTION_IDS.filter(
                  (id) => id === ids[i] || !ids.includes(id),
                ).map((id) => (
                  <option key={id} value={id}>
                    {t(`securityQuestions.catalog.${id}`)}
                  </option>
                ))}
              </Select>
              {ids[i] ? (
                // The selector shortens long text on a phone; show it whole.
                <p className="text-sm leading-snug text-muted-foreground">
                  {t(
                    `securityQuestions.catalog.${ids[i] as SecurityQuestionId}`,
                  )}
                </p>
              ) : null}
              <Label htmlFor={`sq-answer-${i}`} className="sr-only">
                {t("securityQuestions.dialog.answer", { n: i + 1 })}
              </Label>
              <Input
                id={`sq-answer-${i}`}
                autoComplete="off"
                maxLength={200}
                placeholder={t("securityQuestions.dialog.answer", { n: i + 1 })}
                value={answers[i]}
                aria-invalid={submitted && !normalized[i]}
                onChange={(event) =>
                  setAnswers((prev) =>
                    prev.map((v, k) => (k === i ? event.target.value : v)),
                  )
                }
              />
            </div>
          ))}

          {submitted && errors.questions ? (
            <p role="alert" className="text-sm text-destructive">
              {t("securityQuestions.dialog.validation.distinctQuestions")}
            </p>
          ) : null}
          {submitted && errors.answerRequired ? (
            <p role="alert" className="text-sm text-destructive">
              {t("securityQuestions.dialog.validation.required")}
            </p>
          ) : null}
          {submitted && !errors.answerRequired && errors.answerMin ? (
            <p role="alert" className="text-sm text-destructive">
              {t("securityQuestions.dialog.validation.answerMin")}
            </p>
          ) : null}
          {submitted && errors.answerDistinct ? (
            <p role="alert" className="text-sm text-destructive">
              {t("securityQuestions.dialog.validation.distinctAnswers")}
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="sq-current-password">
              {t("securityQuestions.dialog.currentPassword")}
            </Label>
            <PasswordInput
              id="sq-current-password"
              autoComplete="current-password"
              value={password}
              aria-invalid={submitted && errors.password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("securityQuestions.dialog.currentPasswordHelp")}
            </p>
          </div>
        </div>
        <div
          className={`${modalFooter} flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`}
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            onClick={() => onOpenChange(false)}
          >
            {t("securityQuestions.dialog.cancel")}
          </Button>
          <LoadingButton
            type="button"
            className="min-h-11 sm:min-h-9"
            loading={mutation.isPending}
            onClick={submit}
          >
            {t("securityQuestions.dialog.save")}
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
