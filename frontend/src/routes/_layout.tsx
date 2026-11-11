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
import { UsersService } from "@/client"
import { Footer } from "@/components/Common/Footer"
import { IdleSignOut } from "@/components/Common/IdleSignOut"
import { KeyboardShortcuts } from "@/components/Common/KeyboardShortcuts"
import { AppShellSkeleton } from "@/components/Common/PageSkeleton"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import { User } from "@/components/Sidebar/User"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { getLocale } from "@/lib/locale"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  pendingComponent: AppShellSkeleton,
  beforeLoad: async () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" })

    try {
      const response = await UsersService.readUserMe()
      if (response.data.must_change_password) {
        throw redirect({ to: "/change-password" })
      }
    } catch (error) {
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

function Layout() {
  // Subscribes this component to language changes so the clock is re-formatted.
  const { t } = useTranslation()
  const [now, setNow] = useState(() => new Date())
  const { theme, setTheme } = useTheme()
  const { user: currentUser } = useAuth()
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
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    const handleFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement))
    const handleScroll = () => setIsScrolled(window.scrollY > 4)
    handleScroll()
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }

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
    <SidebarProvider>
      <KeyboardShortcuts />
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
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 border-border bg-muted/40 text-foreground hover:bg-muted"
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
              className="size-9 shrink-0 border-border bg-muted/40 text-foreground hover:bg-muted"
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
          className="flex-1 p-4 outline-none sm:p-6 md:p-8"
        >
          <div key={pathname} className="page-enter mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
