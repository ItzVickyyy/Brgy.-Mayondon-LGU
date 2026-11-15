import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import type { TFunction } from "i18next"
import { Lock, LockKeyhole, Mail } from "lucide-react"
import { type CSSProperties, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import type { Body_login_login_access_token as AccessToken } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { MfaStep } from "@/components/TwoFactor/MfaStep"
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
import { PasswordInput } from "@/components/ui/password-input"
import { pageTitle } from "@/config/site"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

type FormData = { username: string; password: string }

/** Staggers the entrance of each block (see auth-layout.css). */
const delay = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties

const iconClass =
  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-hover:text-foreground group-focus-within:text-brand"

function getLoginErrorMessage(error: unknown, t: TFunction): string {
  const candidate = error as {
    message?: unknown
    body?: { detail?: unknown; message?: unknown }
    detail?: unknown
    status?: unknown
  } | null
  const apiMessage = [
    candidate?.body?.detail,
    candidate?.body?.message,
    candidate?.detail,
    candidate?.message,
  ].find((value): value is string => typeof value === "string")
  const normalized = apiMessage?.toLowerCase() ?? ""

  if (
    normalized.includes("incorrect") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("wrong password")
  ) {
    return t("login.errorIncorrect")
  }
  if (candidate?.status === 401) {
    return t("login.errorIncorrect")
  }
  return t("login.errorGeneric")
}

export const Route = createFileRoute("/login")({
  component: Login,
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
        title: pageTitle("Log In"),
      },
    ],
  }),
})

function Login() {
  const { t } = useTranslation()
  const { loginMutation } = useAuth()
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const formSchema = useMemo(
    () =>
      z.object({
        username: z.email({ message: t("login.invalidEmail") }),
        password: z
          .string()
          .min(1, { message: t("login.passwordRequired") })
          .min(8, { message: t("login.passwordTooShort") }),
      }) satisfies z.ZodType<AccessToken>,
    [t],
  )
  const loginErrorMessage = loginMutation.error
    ? getLoginErrorMessage(loginMutation.error, t)
    : null
  const passwordChangedNotice =
    new URLSearchParams(window.location.search).get("passwordChanged") === "1"
  const idleNotice =
    new URLSearchParams(window.location.search).get("idle") === "1"
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = (data: FormData) => {
    if (loginMutation.isPending) return
    loginMutation.mutate(data, {
      onSuccess: (result) => setMfaToken(result.mfaToken),
    })
  }

  if (mfaToken) {
    return (
      <AuthLayout>
        <MfaStep
          mfaToken={mfaToken}
          onExpired={() => {
            setMfaToken(null)
            loginMutation.reset()
          }}
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
          <div className="auth-rise flex flex-col gap-1" style={delay(60)}>
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
              <LockKeyhole aria-hidden="true" className="size-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("login.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("login.subtitle")}
            </p>
          </div>

          {passwordChangedNotice ? (
            <p
              role="status"
              className="animate-in fade-in-0 rounded-md border border-brand/20 bg-brand/10 px-3 py-2 text-sm text-foreground duration-200"
            >
              {t("login.passwordChanged")}
            </p>
          ) : null}

          {idleNotice ? (
            <p
              role="status"
              className="animate-in fade-in-0 rounded-md border border-brand/20 bg-brand/10 px-3 py-2 text-sm text-foreground duration-200"
            >
              {t("login.idleSignedOut")}
            </p>
          ) : null}

          {loginErrorMessage ? (
            <p
              role="alert"
              className="animate-in fade-in-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive duration-200"
            >
              {loginErrorMessage}
            </p>
          ) : null}

          <div className="grid gap-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="auth-rise relative" style={delay(120)}>
                  <FormLabel>{t("login.emailLabel")}</FormLabel>
                  <div className="group relative">
                    <Mail aria-hidden="true" className={iconClass} />
                    <FormControl>
                      <Input
                        data-testid="email-input"
                        placeholder={t("login.emailPlaceholder")}
                        type="email"
                        autoComplete="username"
                        className="h-11 pl-10 hover:border-ring/50"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage className="absolute top-full left-0 mt-0.5 min-h-0 text-xs leading-4" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="auth-rise relative" style={delay(180)}>
                  <div className="flex items-center">
                    <FormLabel>{t("login.passwordLabel")}</FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="ml-auto text-sm font-medium text-brand underline-offset-4 transition-colors hover:text-brand/80 hover:underline"
                    >
                      {t("login.forgotPassword")}
                    </RouterLink>
                  </div>
                  <div className="group relative">
                    <Lock aria-hidden="true" className={iconClass} />
                    <FormControl>
                      <PasswordInput
                        data-testid="password-input"
                        placeholder={t("login.passwordPlaceholder")}
                        autoComplete="current-password"
                        className="h-11 pl-10"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage className="absolute top-full left-0 mt-0.5 min-h-0 text-xs leading-4" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              className="auth-rise auth-cta h-11 w-full hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
              style={delay(240)}
              loading={loginMutation.isPending}
            >
              {t("login.submit")}
            </LoadingButton>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
