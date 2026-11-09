import { Appearance } from "@/components/Common/Appearance"
import { FullscreenButton } from "@/components/Common/FullscreenButton"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* Solid navy band behind the logo and name, the same colour as the
          sidebar. Decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] border-b border-sidebar-border bg-sidebar"
      />

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <Appearance />
        <FullscreenButton />
      </div>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-16 sm:px-6 sm:pt-14">
        <div className="page-enter w-full max-w-md">
          <header className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="rounded-full bg-white/10 p-2 ring-1 ring-white/25">
              <Logo
                variant="icon"
                className="size-24 sm:size-28"
                asLink={false}
              />
            </span>
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Brgy. Mayondon
              </h2>
              <p className="text-base text-white/75">Los Baños, Laguna</p>
            </div>
          </header>

          <section className="relative overflow-hidden rounded-lg border bg-card p-6 shadow-lg shadow-black/10 sm:p-8">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-sidebar-primary"
            />
            {children}
          </section>
        </div>
      </main>

      <div className="relative px-4 pb-4 sm:px-6">
        <Footer />
      </div>
    </div>
  )
}
