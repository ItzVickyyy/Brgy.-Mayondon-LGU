import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { Clock3, XCircle } from "lucide-react"

import { AuthLayout } from "@/components/Common/AuthLayout"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/pending-approval")({
  component: PendingApproval,
  head: () => ({ meta: [{ title: pageTitle("Account Approval Status") }] }),
})

function PendingApproval() {
  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Account Approval Status
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Account approval status and next steps.
          </p>
        </div>
        <section className="flex gap-3 rounded-xl border p-4">
          <Clock3
            className="mt-0.5 size-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold">Pending account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account is awaiting approval.
            </p>
          </div>
        </section>
        <section className="flex gap-3 rounded-xl border p-4">
          <XCircle
            className="mt-0.5 size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold">Request not approved</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your request was not approved. Please contact the System
              Administrator.
            </p>
          </div>
        </section>

        <RouterLink
          to="/login"
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to Staff Login
        </RouterLink>
      </div>
    </AuthLayout>
  )
}
