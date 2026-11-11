import { Appearance } from "@/components/Common/Appearance"
import { FullscreenButton } from "@/components/Common/FullscreenButton"
import { Logo } from "@/components/Common/Logo"
import { SITE } from "@/config/site"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

const BRAND_NAME = "Brgy. Mayondon"

/** Soft water lines for the brand panel. Decorative only. */
function Waves() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 240"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full text-primary dark:text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M0 70 C120 30 240 110 400 70 S680 30 800 70" opacity="0.16" />
      <path d="M0 110 C120 70 240 150 400 110 S680 70 800 110" opacity="0.12" />
      <path
        d="M0 150 C120 110 240 190 400 150 S680 110 800 150"
        opacity="0.09"
      />
      <path
        d="M0 190 C120 150 240 230 400 190 S680 150 800 190"
        opacity="0.06"
      />
    </svg>
  )
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[5fr_4fr]">
      {/* Brand panel: desktop only. Follows the theme: a soft blue-grey in
          light mode, the sidebar navy in dark mode. */}
      <aside className="relative hidden overflow-hidden border-r bg-accent text-foreground dark:border-sidebar-border dark:bg-sidebar dark:text-white lg:flex lg:items-center lg:justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 dark:hidden"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 20% 15%, oklch(0.85 0.12 85 / 28%), transparent 70%), radial-gradient(70% 60% at 90% 100%, oklch(0.7 0.1 250 / 22%), transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 20% 15%, oklch(0.8 0.12 85 / 14%), transparent 70%), radial-gradient(70% 60% at 90% 100%, oklch(0.55 0.14 250 / 30%), transparent 70%)",
          }}
        />
        <Waves />

        <div className="page-enter relative flex max-w-sm flex-col items-center gap-6 px-10 text-center">
          <Logo variant="icon" className="size-44" asLink={false} />
          <div className="space-y-3">
            <p className="text-4xl font-bold tracking-tight">{BRAND_NAME}</p>
            <div
              aria-hidden="true"
              className="mx-auto h-0.5 w-10 rounded-full bg-sidebar-primary"
            />
            <p className="text-base text-muted-foreground dark:text-white/75">
              {SITE.location}
            </p>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <div className="relative flex min-h-svh flex-col">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
          <Appearance />
          <FullscreenButton />
        </div>

        <main className="flex flex-1 items-center justify-center px-6 pb-10 pt-20 sm:px-10 lg:pt-10">
          <div className="page-enter w-full max-w-sm">
            {/* Compact brand header for small screens, where the panel is hidden */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <Logo variant="icon" className="size-14" asLink={false} />
              <div className="leading-tight">
                <p className="text-lg font-semibold">{BRAND_NAME}</p>
                <p className="text-sm text-muted-foreground">{SITE.location}</p>
              </div>
            </div>

            {children}
          </div>
        </main>

        <div className="px-4 pb-2 sm:px-6">
          <Footer variant="auth" />
        </div>
      </div>
    </div>
  )
}
