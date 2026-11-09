import { Appearance } from "@/components/Common/Appearance"
import { FullscreenButton } from "@/components/Common/FullscreenButton"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-gradient-to-b from-brand/5 to-background to-40%">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <Appearance />
        <FullscreenButton />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-20 sm:px-6 sm:py-12">
        <div className="page-enter w-full max-w-md">
          <header className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo
              variant="icon"
              className="size-28 sm:size-32"
              asLink={false}
            />
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Brgy. Mayondon
              </h2>
              <p className="text-base text-muted-foreground">
                Los Baños, Laguna
              </p>
            </div>
          </header>

          <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
            {children}
          </section>
        </div>
      </main>

      <div className="px-4 pb-4 sm:px-6">
        <Footer />
      </div>
    </div>
  )
}
