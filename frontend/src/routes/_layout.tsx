import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { SITE } from "@/config/site"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/items": "Items",
  "/admin": "Administration",
  "/settings": "User settings",
}

function Layout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const pageLabel = PAGE_LABELS[pathname] ?? "Page"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0 text-muted-foreground" />
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-2 text-sm">
              <li className="truncate text-muted-foreground">{SITE.shortName}</li>
              <li aria-hidden="true">
                <ChevronRight className="size-4 text-muted-foreground" />
              </li>
              <li aria-current="page" className="truncate font-medium">
                {pageLabel}
              </li>
            </ol>
          </nav>
          <span className="ml-auto hidden truncate text-xs text-muted-foreground md:block">
            {SITE.systemName}
          </span>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
