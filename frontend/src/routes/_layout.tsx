import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router"
import { CalendarDays, ChevronRight, Clock3, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { SITE } from "@/config/site"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) throw redirect({ to: "/welcome" })
  },
})

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/issuances": "Document Management",
  "/records": "Resident Records",
  "/barangay-ids": "Barangay ID Management",
  "/officials": "Officials",
  "/admin": "User Accounts",
  "/activity-log": "Activity Log",
  "/reports": "Management Reports",
  "/backup-restore": "Backup and Restore",
}

function Layout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const pageLabel = PAGE_LABELS[pathname] ?? "Barangay Records System"
  const [now, setNow] = useState(() => new Date())
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const dateText = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now)
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
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-2 text-sm">
              <li className="truncate text-muted-foreground">{SITE.shortName}</li>
              <li aria-hidden="true"><ChevronRight className="size-4 text-muted-foreground" /></li>
              <li aria-current="page" className="truncate font-medium">{pageLabel}</li>
            </ol>
          </nav>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              <span>{dateText}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock3 className="size-4" aria-hidden="true" />
              <span>{timeText}</span>
            </span>
            </div>
          </div>
        </header>
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
