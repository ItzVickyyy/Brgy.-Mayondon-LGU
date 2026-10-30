import { Appearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
      />

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <Appearance />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-20 sm:px-6 sm:py-16">
        <div className="w-full max-w-md">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
              <Logo variant="icon" className="size-9" asLink={false} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Barangay Mayondon
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Personnel Portal
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to access the barangay management system.
              </p>
            </div>
          </div>

          <section className="rounded-2xl border bg-card p-6 shadow-lg shadow-black/[0.03] sm:p-8">
            {children}
          </section>

          <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-5 text-muted-foreground">
            Restricted access. For authorized barangay office personnel only.
          </p>
        </div>
      </main>

      <div className="px-4 pb-4 sm:px-6">
        <Footer />
      </div>
    </div>
  )
}
