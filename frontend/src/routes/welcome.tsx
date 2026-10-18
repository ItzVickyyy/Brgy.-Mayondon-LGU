import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import { Logo } from "@/components/Common/Logo"
import { pageTitle, SITE } from "@/config/site"

export const Route = createFileRoute("/welcome")({
  component: PublicLandingPage,
  head: () => ({
    meta: [{ title: pageTitle("Welcome") }],
  }),
})

function PublicLandingPage() {
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        <section className="rounded-2xl border bg-card px-6 py-10 sm:px-10 sm:py-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            {SITE.location}
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            {SITE.fullName}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Welcome to the public information page for Barangay Mayondon. Official
            updates and contact details will be published here after confirmation
            by the barangay office.
          </p>
          <RouterLink
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Barangay Staff Login
          </RouterLink>
        </section>

        <section aria-labelledby="announcements-heading" className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border bg-card p-6">
            <h2 id="announcements-heading" className="text-xl font-semibold">
              Announcements
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Barangay announcements will appear here when the office provides
              and approves the information for publication.
            </p>
          </article>
          <article className="rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Contact Information</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Official office address, telephone number, and service hours will
              be added after they are confirmed with the barangay.
            </p>
          </article>
        </section>
      </main>

      <Footer />
    </div>
  )
}
