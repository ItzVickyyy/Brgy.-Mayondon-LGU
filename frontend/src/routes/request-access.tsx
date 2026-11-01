import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"

import { AuthLayout } from "@/components/Common/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/request-access")({
  component: RequestAccess,
  head: () => ({ meta: [{ title: pageTitle("Request Staff Access") }] }),
})

function RequestAccess() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Request Staff Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">This is a visual prototype of a staff access request. It does not create an account or send information anywhere.</p>
        </div>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          Prototype: this request is not saved.
        </div>
        {submitted ? (
          <div role="status" className="rounded-lg border p-4 text-sm">
            This prototype did not submit or save your details. In a real system, the barangay must confirm the request and approval workflow first.
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-medium">Full name<Input name="full_name" autoComplete="name" required /></label>
            <label className="grid gap-2 text-sm font-medium">Barangay office email<Input name="email" type="email" autoComplete="email" required /></label>
            <label className="grid gap-2 text-sm font-medium">Position or office assignment<Input name="position" required /></label>
            <Button type="submit" className="min-h-11">Preview Request</Button>
          </form>
        )}
        <p className="text-sm text-muted-foreground">Access requests require review by the authorized System Administrator. Public self-registration for administrator access is not available.</p>
        <RouterLink to="/pending-approval" className="text-sm font-medium text-primary underline-offset-4 hover:underline">View pending or rejected account messages</RouterLink>
        <RouterLink to="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Back to Staff Login</RouterLink>
      </div>
    </AuthLayout>
  )
}
