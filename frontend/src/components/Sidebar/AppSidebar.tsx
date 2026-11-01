import { Activity, BarChart3, BookUser, Clock3, DatabaseBackup, FileCheck2, IdCard, LayoutDashboard, Users, ShieldCheck } from "lucide-react"

import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { type Item, Main } from "./Main"

type NavigationItem = Item & { adminOnly?: boolean }

const items: NavigationItem[] = [
  { icon: LayoutDashboard, title: "Dashboard", path: "/", section: "Workspace" },
  { icon: Activity, title: "Activity Log", path: "/activity-log", section: "Workspace" },
  { icon: Users, title: "Resident Records", path: "/records", section: "Records and Documents" },
  { icon: FileCheck2, title: "Issuance Management", path: "/issuances", section: "Records and Documents" },
  { icon: IdCard, title: "Barangay IDs", path: "/barangay-ids", section: "Records and Documents" },
  { icon: BookUser, title: "Officials", path: "/officials", adminOnly: true, section: "Administration" },
  { icon: ShieldCheck, title: "User Accounts", path: "/admin", adminOnly: true, section: "Administration" },
  { icon: Clock3, title: "Pending Registrations", path: "/pending-registrations", adminOnly: true, section: "Administration", badge: 2 },
  { icon: BarChart3, title: "Management Reports", path: "/reports", adminOnly: true, section: "Administration" },
  { icon: DatabaseBackup, title: "Backup and Restore", path: "/backup-restore", adminOnly: true, section: "Administration" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const visibleItems = items.filter((item) => !item.adminOnly || isSystemAdministrator(currentUser))

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
