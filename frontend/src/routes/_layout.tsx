import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router"
import {
  CalendarDays,
  Clock3,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AppBackdrop } from "@/components/Common/AppBackdrop"
import { BackToTop } from "@/components/Common/BackToTop"
import { Footer } from "@/components/Common/Footer"
import { IdleSignOut } from "@/components/Common/IdleSignOut"
import { KeyboardShortcuts } from "@/components/Common/KeyboardShortcuts"
import { NotificationBell } from "@/components/Common/NotificationBell"
import { AppShellSkeleton } from "@/components/Common/PageSkeleton"
import { QuickSearch } from "@/components/Common/QuickSearch"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import { User } from "@/components/Sidebar/User"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { useLoadPreferences, usePreferences } from "@/hooks/usePreferences"
import { getLocale } from "@/lib/locale"
import { isSignedInElsewhere, loadCurrentUser } from "@/lib/queryClient"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  pendingComponent: AppShellSkeleton,
  beforeLoad: async () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" })

    try {
      const me = await loadCurrentUser()
      if (me.must_change_password || me.password_expired) {
        throw redirect({ to: "/change-password" })
      }
    } catch (error) {
      if (isSignedInElsewhere(error)) {
        localStorage.removeItem("access_token")
        throw redirect({ href: "/login?elsewhere=1" })
      }
      if (error && typeof error === "object" && "status" in error) {
        const status = error.status
        if (status === 401 || status === 403) {
          localStorage.removeItem("access_token")
          throw redirect({ to: "/login" })
        }
      }
      throw error
    }
  },
})

/**
 * The date and the ticking time in the header. It owns the once-a-second state, so only this small
 * piece draws every second, not the whole layout, sidebar and page (patch 237). `useTranslation`
 * re-formats it when the language changes.
 */
function HeaderClock() {
  useTranslation()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const dateText = new Intl.DateTimeFormat(getLocale(), {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  }).format(now)
  const formattedDate = dateText.replace(
    /,\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/,
    " ($1)",
  )
  const timeText = new Intl.DateTimeFormat(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 sm:whitespace-nowrap">
        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 leading-tight">{formattedDate}</span>
      </span>
      <span className="hidden items-center gap-1.5 whitespace-nowrap tabular-nums sm:inline-flex">
        <Clock3 className="size-4 shrink-0" aria-hidden="true" />
        <span>{timeText}</span>
      </span>
    </div>
  )
}

function Layout() {
  // Subscribes this component to language changes.
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  // The person's saved theme, accent colour and font size (Preferences).
  useLoadPreferences(currentUser?.id ? String(currentUser.id) : undefined)
  const { theme, setTheme } = usePreferences()
  const isDark = theme === "dark"
  const [isFullscreen, setIsFullscreen] = useState(false)
  // A soft shadow under the sticky header once the page has scrolled.
  const [isScrolled, setIsScrolled] = useState(false)
  // Keying the page wrapper by path replays the soft entrance on each page.
  // `resolvedLocation` only changes once the next page has finished loading;
  // `location` changes the moment a link is clicked, which re-keyed the page
  // that was still on screen and made it fade out and back in before the new
  // page appeared.
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  })

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement))
    const handleScroll = () => setIsScrolled(window.scrollY > 4)
    handleScroll()
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const currentUserId = currentUser?.id

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }

  return (
    <SidebarProvider>
      <KeyboardShortcuts />
      <QuickSearch />
      <IdleSignOut />
      <AppSidebar />
      <SidebarInset>
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-background px-4 py-3 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-ring"
        >
          {t("common.ui.skipToMain")}
        </a>
        <header
          className={`sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur transition-shadow duration-200 sm:px-4 ${
            isScrolled ? "shadow-sm" : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SidebarTrigger className="-ml-1 shrink-0 text-muted-foreground" />
            <HeaderClock />
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            {/* The "N selected" count of a table is drawn here (SelectionControls, 292). */}
            <div
              id="selection-count-slot"
              className="flex shrink-0 items-center"
            />
            {currentUserId ? (
              <NotificationBell ownerId={String(currentUserId)} />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="icon-react icon-turn size-9 shrink-0 border-border bg-card text-foreground shadow-xs hover:bg-muted"
              aria-label={
                isDark ? t("common.ui.lightMode") : t("common.ui.darkMode")
              }
              title={
                isDark ? t("common.ui.lightMode") : t("common.ui.darkMode")
              }
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="icon-react icon-grow size-9 shrink-0 border-border bg-card text-foreground shadow-xs hover:bg-muted"
              aria-label={
                isFullscreen
                  ? t("common.ui.exitFullscreen")
                  : t("common.ui.enterFullscreen")
              }
              title={
                isFullscreen
                  ? t("common.ui.exitFullscreen")
                  : t("common.ui.enterFullscreen")
              }
              onClick={() => {
                void toggleFullscreen()
              }}
            >
              {isFullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
            <div
              aria-hidden="true"
              className="mx-1 h-7 w-px shrink-0 bg-border"
            />
            <User user={currentUser} compact />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex-1 p-3 outline-none sm:p-4 md:p-5"
        >
          <AppBackdrop />
          <div
            key={pathname}
            className="page-enter relative mx-auto max-w-[96rem]"
          >
            <Outlet />
          </div>
        </main>
        <Footer />
        <BackToTop />
      </SidebarInset>
    </SidebarProvider>
  )
}
