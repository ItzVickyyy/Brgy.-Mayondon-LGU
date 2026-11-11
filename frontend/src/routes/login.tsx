import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import type { TFunction } from "i18next"
import { ArrowRight } from "lucide-react"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import type { Body_login_login_access_token as AccessToken } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
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
    loginMutation.mutate(data)
  }

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
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
                <FormItem>
                  <FormLabel>{t("login.emailLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      placeholder={t("login.emailPlaceholder")}
                      type="email"
                      autoComplete="username"
                      className="h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <FormLabel>{t("login.passwordLabel")}</FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="ml-auto text-sm font-medium text-brand underline-offset-4 hover:underline"
                    >
                      {t("login.forgotPassword")}
                    </RouterLink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder={t("login.passwordPlaceholder")}
                      autoComplete="current-password"
                      className="h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              className="h-11 w-full"
              loading={loginMutation.isPending}
            >
              {t("login.submit")} <ArrowRight className="ml-2 size-4" />
            </LoadingButton>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
