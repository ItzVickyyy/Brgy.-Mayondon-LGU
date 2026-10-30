import { Appearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh flex-col bg-muted/30">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <Appearance />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-4 text-center">
            <Logo variant="full" className="h-12 w-auto" asLink={false} />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Authorized Personnel
              </p>
              <h2 className="text-lg font-semibold tracking-tight">
                Barangay Mayondon
              </h2>
            </div>
          </div>

          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            {children}
          </section>

          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            This system is for authorized barangay office personnel only.
          </p>
        </div>
      </main>

      <div className="px-4 pb-4 sm:px-6">
        <Footer />
      </div>
    </div>
  )
}
