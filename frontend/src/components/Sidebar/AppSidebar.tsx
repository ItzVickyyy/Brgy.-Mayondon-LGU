import {
  Activity,
  BarChart3,
  BookUser,
  Clock3,
  DatabaseBackup,
  FileCheck2,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react"

import { Logo } from "@/components/Common/Logo"
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { useRegistrations } from "@/lib/registration-store"
import { type Item, Main } from "./Main"

type NavigationItem = Item & { adminOnly?: boolean }

const items: NavigationItem[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    path: "/",
    section: "Workspace",
  },
  {
    icon: Activity,
    title: "Activity Log",
    path: "/activity-log",
    section: "Workspace",
  },
  {
    icon: FileCheck2,
    title: "Issuance Management",
    path: "/issuances",
    section: "Records and Documents",
  },
  {
    icon: Users,
    title: "Records Management",
    path: "/records",
    section: "Records and Documents",
  },
  {
    icon: BookUser,
    title: "Officials",
    path: "/officials",
    adminOnly: true,
    section: "Administration",
  },
  {
    icon: ShieldCheck,
    title: "User Accounts",
    path: "/admin",
    adminOnly: true,
    section: "Administration",
  },
  {
    icon: Clock3,
    title: "Pending Registrations",
    path: "/pending-registrations",
    adminOnly: true,
    section: "Administration",
  },
  {
    icon: BarChart3,
    title: "Management Reports",
    path: "/reports",
    adminOnly: true,
    section: "Administration",
  },
  {
    icon: DatabaseBackup,
    title: "Backup and Restore",
    path: "/backup-restore",
    adminOnly: true,
    section: "Administration",
  },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const registrations = useRegistrations()
  const pendingCount = registrations.filter((row) => row.status === "Pending").length
  const visibleItems = items
    .map((item) =>
      item.path === "/pending-registrations"
        ? { ...item, badge: pendingCount }
        : item,
    )
    .filter((item) => !item.adminOnly || isSystemAdministrator(currentUser))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 min-h-16 justify-center border-b px-4 py-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent className="pt-3">
        <Main items={visibleItems} />
      </SidebarContent>
    </Sidebar>
  )
}

export default AppSidebar
