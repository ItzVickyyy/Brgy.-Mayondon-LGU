import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { CalendarDays, Clock3, LogOut, Maximize2, Minimize2, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import useAuth from "@/hooks/useAuth"
import { useTheme } from "@/components/theme-provider"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) throw redirect({ to: "/welcome" })
  },
})

function Layout() {
  const [now, setNow] = useState(() => new Date())
  const { theme, setTheme } = useTheme()
  const { logout } = useAuth()
  const isDark = theme === "dark"
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }

  const dateText = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  }).format(now)
  const formattedDate = dateText.replace(/,\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/, " ($1)")
  const timeText = new Intl.DateTimeFormat("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0 text-muted-foreground" />

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground sm:gap-3 sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                <span>{formattedDate}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock3 className="size-4" aria-hidden="true" />
                <span>{timeText}</span>
              </span>
            </div>
            <span aria-hidden="true" className="text-muted-foreground/60">|</span>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(isDark ? "light" : "dark")}>
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"} title={isFullscreen ? "Exit full screen" : "Enter full screen"} onClick={() => { void toggleFullscreen() }}>
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" aria-label="Log out" title="Log out" onClick={() => setLogoutOpen(true)}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Log out?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to log out of your account?</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLogoutOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={() => { setLogoutOpen(false); void logout() }}>Log out</Button>
            </div>
          </DialogContent>
        </Dialog>
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
