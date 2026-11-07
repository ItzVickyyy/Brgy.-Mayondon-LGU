import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { useForm } from "react-hook-form"
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

const formSchema = z.object({
  username: z.email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .min(8, { message: "Password must be at least 8 characters" }),
}) satisfies z.ZodType<AccessToken>

type FormData = z.infer<typeof formSchema>

function getLoginErrorMessage(error: unknown): string {
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

  if (normalized.includes("pending") && normalized.includes("approval")) {
    return "Your account is pending approval. Please wait for the System Administrator to review your request."
  }
  if (
    normalized.includes("not approved") ||
    normalized.includes("rejected")
  ) {
    return "Your access request has not been approved. Contact the System Administrator for assistance."
  }
  if (
    normalized.includes("incorrect") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("wrong password")
  ) {
    return "The email address or password is incorrect. Please check your credentials and try again."
  }
  if (candidate?.status === 401) {
    return "The email address or password is incorrect. Please check your credentials and try again."
  }
  return "We could not sign you in. Please try again or contact the System Administrator if the problem continues."
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
  const { loginMutation } = useAuth()
  const loginErrorMessage = loginMutation.error
    ? getLoginErrorMessage(loginMutation.error)
    : null
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
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
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to access the barangay personnel portal.
            </p>
          </div>

          {loginErrorMessage ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
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
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      placeholder="Enter your email address"
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
                    <FormLabel>Password</FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="ml-auto text-sm font-medium text-brand underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </RouterLink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="Enter your password"
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
              Sign in <ArrowRight className="ml-2 size-4" />
            </LoadingButton>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
