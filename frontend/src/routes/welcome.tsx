import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import { Logo } from "@/components/Common/Logo"
import { pageTitle, SITE } from "@/config/site"

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
  head: () => ({ meta: [{ title: pageTitle("Staff Access") }] }),
})

function WelcomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo variant="responsive" />
          <RouterLink
            to="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Staff Login
          </RouterLink>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <section className="rounded-2xl border bg-card px-6 py-10 sm:px-10 sm:py-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            {SITE.location}
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            {SITE.systemName}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            A staff-facing workspace for resident records, document preparation, issuance history, and Barangay ID workflows.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            This system is being prepared for local use by authorized barangay office personnel. It is a design prototype and is not yet approved for handling live resident records.
          </p>
          <RouterLink
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Continue to Staff Login
          </RouterLink>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Resident Records", description: "Find and maintain resident information in one place." },
            { title: "Document Preparation", description: "Prepare approved documents and print variable details." },
            { title: "Issuance History", description: "Keep a clear history of document issuance and corrections." },
          ].map((item) => (
            <article key={item.title} className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  )
}
