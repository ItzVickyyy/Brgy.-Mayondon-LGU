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
      {/* Navy hero behind the logo and name. Decorative only. The soft colour
          glows echo the sidebar's per-section colours. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] overflow-hidden bg-gradient-to-br from-[oklch(0.33_0.12_264)] via-[oklch(0.26_0.09_260)] to-[oklch(0.2_0.07_256)]"
      >
        <div className="absolute -left-24 -top-24 size-80 rounded-full bg-[oklch(0.7_0.15_235/0.35)] blur-3xl" />
        <div className="absolute -right-20 top-10 size-72 rounded-full bg-[oklch(0.65_0.2_300/0.3)] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-64 rounded-full bg-[oklch(0.75_0.13_175/0.22)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <Appearance />
        <FullscreenButton />
      </div>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-16 sm:px-6 sm:pt-14">
        <div className="page-enter w-full max-w-md">
          <header className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="rounded-full bg-white/10 p-2 shadow-lg ring-1 ring-white/25 backdrop-blur">
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

          <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-xl shadow-[oklch(0.3_0.1_262/0.18)] sm:p-8">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[oklch(0.7_0.15_235)] via-[oklch(0.62_0.2_295)] to-[oklch(0.75_0.14_175)]"
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
