import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { AxiosError } from "axios"
import type { TFunction } from "i18next"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { LoginService, SecurityQuestionsService } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { RecoveryQuestionsStep } from "@/components/SecurityQuestions/RecoveryQuestionsStep"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { pageTitle } from "@/config/site"
import { isLoggedIn } from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const buildSchema = (t: TFunction) =>
  z.object({
    email: z.email({ message: t("password.validation.invalidEmail") }),
  })

type FormData = z.infer<ReturnType<typeof buildSchema>>

export const Route = createFileRoute("/recover-password")({
  component: RecoverPassword,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: pageTitle("Recover Password"),
      },
    ],
  }),
})

function RecoverPassword() {
  const { t } = useTranslation()
  const formSchema = useMemo(() => buildSchema(t), [t])
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [offlineNotice, setOfflineNotice] = useState<string | null>(null)
  // After an e-mail was requested, offer the questions as another way.
  const [emailSent, setEmailSent] = useState(false)
  const [questions, setQuestions] = useState<{
    email: string
    ids: string[]
  } | null>(null)

  const loadQuestions = async (email: string) => {
    const response = await SecurityQuestionsService.questionsRecoveryQuestions({
      body: { email },
    })
    return {
      email: email.trim().toLowerCase(),
      ids: response.data.question_ids,
    }
  }

  const questionsMutation = useMutation({
    mutationFn: loadQuestions,
    onSuccess: setQuestions,
    onError: (err: Error) => {
      const status =
        err instanceof AxiosError ? err.response?.status : undefined
      if (status === 429) {
        showErrorToast(t("securityQuestions.recovery.tooMany"))
        return
      }
      handleError.bind(showErrorToast)(err)
    },
  })

  const recoverPassword = async (data: FormData) => {
    const response = await LoginService.recoverPassword({
      body: { email: data.email },
    })
    return { message: response.data?.message, email: data.email }
  }

  const mutation = useMutation({
    mutationFn: recoverPassword,
    onSuccess: (response) => {
      // When the installation has no email, the server says so. Go straight to
      // the security questions, so nobody waits for an email that never comes.
      if (response.message?.toLowerCase().includes("unavailable")) {
        setOfflineNotice(null)
        questionsMutation.mutate(response.email)
        return
      }
      setOfflineNotice(null)
      setEmailSent(true)
      showSuccessToast(t("common.toast.recoveryLinkSent"))
    },
    onError: handleError.bind(showErrorToast),
  })

  const onSubmit = async (data: FormData) => {
    if (mutation.isPending) return
    mutation.mutate(data)
  }

  if (questions) {
    return (
      <AuthLayout>
        <RecoveryQuestionsStep
          email={questions.email}
          questionIds={questions.ids}
          onBack={() => setQuestions(null)}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">
              {t("password.recovery.title")}
            </h1>
          </div>

          {offlineNotice ? (
            <p
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              {offlineNotice} {t("password.recovery.offlineHelp")}
            </p>
          ) : null}

          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("password.email")}</FormLabel>
                  <FormControl>
                    <Input data-testid="email-input" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              className="w-full"
              loading={mutation.isPending || questionsMutation.isPending}
            >
              {t("password.recovery.continue")}
            </LoadingButton>
            {emailSent ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full"
                disabled={questionsMutation.isPending}
                onClick={async () => {
                  const valid = await form.trigger("email")
                  if (valid) questionsMutation.mutate(form.getValues("email"))
                }}
              >
                {t("securityQuestions.recovery.useQuestions")}
              </Button>
            ) : null}
          </div>

          <div className="text-center text-sm">
            {t("password.recovery.remember")}{" "}
            <RouterLink to="/login" className="underline underline-offset-4">
              {t("password.recovery.login")}
            </RouterLink>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
