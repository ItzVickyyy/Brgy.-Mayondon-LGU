import type { CSSProperties } from "react"

import { AboutButton } from "@/components/Common/AboutButton"
import { Appearance } from "@/components/Common/Appearance"
import { FullscreenButton } from "@/components/Common/FullscreenButton"
import { Logo } from "@/components/Common/Logo"
import { SITE } from "@/config/site"
import "./auth-layout.css"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

const BRAND_NAME = "Barangay Mayondon"

// Sky blue into warm cream, the same colors as the sky and water in the seal.
const SKY_LIGHT =
  "linear-gradient(160deg, oklch(0.9 0.07 232) 0%, oklch(0.975 0.04 90) 52%, oklch(0.87 0.09 238) 100%)"
const SKY_DARK =
  "linear-gradient(160deg, oklch(0.3 0.08 255) 0%, oklch(0.21 0.05 258) 55%, oklch(0.32 0.1 248) 100%)"
const GOLD = "oklch(0.85 0.14 85 / 0.35)"
const DOT_MASK = "radial-gradient(70% 60% at 50% 45%, black, transparent)"

// Soft bubbles that rise through the panel like water.
const BUBBLES = [
  { left: "6%", size: 18, dur: 17, wait: 0, sway: 24 },
  { left: "16%", size: 34, dur: 22, wait: 4, sway: -30 },
  { left: "28%", size: 12, dur: 15, wait: 9, sway: 18 },
  { left: "42%", size: 26, dur: 20, wait: 2, sway: -22 },
  { left: "55%", size: 16, dur: 16, wait: 11, sway: 26 },
  { left: "68%", size: 38, dur: 24, wait: 6, sway: -34 },
  { left: "80%", size: 20, dur: 18, wait: 13, sway: 20 },
  { left: "91%", size: 14, dur: 14, wait: 8, sway: -16 },
]

const delay = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties

/** One band of water. Twice as wide as the panel so it can slide forever. */
function Wave({
  className,
  duration,
  reverse,
}: {
  className: string
  duration: string
  reverse?: boolean
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1600 200"
      preserveAspectRatio="none"
      className={`auth-wave pointer-events-none absolute bottom-0 left-0 w-[200%] fill-current text-primary dark:text-sky-300 ${className}`}
      style={{
        animationDuration: duration,
        animationDirection: reverse ? "reverse" : "normal",
      }}
    >
      <path d="M0 80 C200 20 200 140 400 80 C600 20 600 140 800 80 C1000 20 1000 140 1200 80 C1400 20 1400 140 1600 80 V200 H0 Z" />
    </svg>
  )
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[5fr_4fr]">
      {/* Brand panel: desktop only. Follows the theme. */}
      <aside className="relative hidden overflow-hidden text-foreground dark:text-white lg:flex lg:items-center lg:justify-center">
        <div
          aria-hidden="true"
          className="auth-drift pointer-events-none absolute inset-0 dark:hidden"
          style={{ backgroundImage: SKY_LIGHT, backgroundSize: "200% 200%" }}
        />
        <div
          aria-hidden="true"
          className="auth-drift pointer-events-none absolute inset-0 hidden dark:block"
          style={{ backgroundImage: SKY_DARK, backgroundSize: "200% 200%" }}
        />

        {/* Faint dot grid that fades out toward the edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16] dark:opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: DOT_MASK,
            WebkitMaskImage: DOT_MASK,
          }}
        />

        {BUBBLES.map((b) => (
          <span
            key={b.left}
            aria-hidden="true"
            className="auth-bubble pointer-events-none absolute -bottom-12 rounded-full border border-white/80 bg-white/40 dark:border-white/25 dark:bg-white/10"
            style={
              {
                left: b.left,
                width: b.size,
                height: b.size,
                "--dur": `${b.dur}s`,
                "--wait": `-${b.wait}s`,
                "--sway": `${b.sway}px`,
              } as CSSProperties
            }
          />
        ))}

        {/* Two slow floating glows for depth */}
        <div
          aria-hidden="true"
          className="auth-float pointer-events-none absolute -left-20 top-8 size-80 rounded-full blur-3xl dark:opacity-50"
          style={{ backgroundColor: GOLD }}
        />
        <div
          aria-hidden="true"
          className="auth-float pointer-events-none absolute -right-16 top-1/3 size-72 rounded-full bg-primary/20 blur-3xl dark:bg-sky-400/25"
          style={{ animationDelay: "-4s" }}
        />

        {/* Moving water along the bottom */}
        <Wave className="h-44 opacity-[0.1]" duration="34s" reverse />
        <Wave className="h-36 opacity-[0.14]" duration="26s" />
        <Wave className="h-28 opacity-[0.2]" duration="19s" reverse />

        <div className="page-enter relative flex max-w-sm flex-col items-center gap-9 px-10 text-center">
          <div className="auth-rise relative" style={delay(0)}>
            {/* Rings around the seal */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="auth-breathe size-64 rounded-full border border-foreground/15 dark:border-white/20" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="auth-spin size-[25rem] rounded-full border border-dashed border-foreground/20 dark:border-white/25" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="size-[34rem] rounded-full border border-foreground/10 dark:border-white/10" />
            </div>

            <Logo
              variant="icon"
              className="relative size-48 drop-shadow-lg"
              asLink={false}
            />
          </div>

          <div className="space-y-3">
            <p
              className="auth-rise text-5xl font-extrabold tracking-tight"
              style={delay(100)}
            >
              {BRAND_NAME}
            </p>
            <div
              aria-hidden="true"
              className="auth-rise mx-auto h-1 w-12 rounded-full"
              style={{ ...delay(160), backgroundColor: "oklch(0.8 0.15 85)" }}
            />
            <p
              className="auth-rise text-lg text-foreground/70 dark:text-white/75"
              style={delay(200)}
            >
              {SITE.location}
            </p>
          </div>

          <p
            className="auth-rise rounded-full border border-foreground/15 bg-white/50 px-4 py-1.5 text-xs font-medium text-foreground/70 backdrop-blur transition-colors hover:bg-white/80 dark:border-white/20 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
            style={delay(280)}
          >
            {SITE.systemName}
          </p>

          <div className="auth-rise" style={delay(340)}>
            <AboutButton className="border border-foreground/15 bg-white/50 text-foreground/80 backdrop-blur hover:bg-white/80 dark:border-white/20 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10" />
          </div>
        </div>
      </aside>

      {/* Form panel: the form sits in a soft card on a tinted background. */}
      <div className="relative flex min-h-svh flex-col overflow-hidden bg-muted/50 dark:bg-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/10 blur-3xl dark:bg-sky-400/10"
        />

        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
          <Appearance />
          <FullscreenButton />
        </div>

        <main className="relative flex flex-1 items-center justify-center px-5 pb-8 pt-20 sm:px-10 lg:pt-10">
          <div className="page-enter w-full max-w-md">
            {/* Compact brand header for small screens, where the panel is hidden */}
            <div
              className="auth-rise mb-6 flex items-center gap-3 lg:hidden"
              style={delay(0)}
            >
              <Logo variant="icon" className="size-14" asLink={false} />
              <div className="leading-tight">
                <p className="text-lg font-semibold">{BRAND_NAME}</p>
                <p className="text-sm text-muted-foreground">{SITE.location}</p>
              </div>
            </div>

            <div className="auth-rise -mt-3 mb-4 lg:hidden" style={delay(40)}>
              <AboutButton className="-ml-4 text-brand hover:bg-brand/10" />
            </div>

            <div className="rounded-2xl border bg-card p-7 shadow-xl shadow-primary/5 transition-shadow duration-300 hover:shadow-2xl hover:shadow-primary/15 sm:p-9">
              {children}
            </div>
          </div>
        </main>

        <div className="relative px-4 pb-2 sm:px-6">
          <Footer variant="auth" />
        </div>
      </div>
    </div>
  )
}
