import { Activity, BarChart3, BookUser, CreditCard, DatabaseBackup, FileCheck2, LayoutDashboard, Users, ShieldCheck } from "lucide-react"

import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"

type NavigationItem = Item & { adminOnly?: boolean }

const items: NavigationItem[] = [
  { icon: LayoutDashboard, title: "Dashboard", path: "/" },
  { icon: FileCheck2, title: "Issuance Management", path: "/issuances" },
  { icon: CreditCard, title: "Barangay ID Management", path: "/barangay-ids" },
  { icon: Users, title: "Resident Records", path: "/records" },
  { icon: BookUser, title: "Officials", path: "/officials", adminOnly: true },
  { icon: ShieldCheck, title: "User Accounts", path: "/admin", adminOnly: true },
  { icon: Activity, title: "Activity Log", path: "/activity-log" },
  { icon: BarChart3, title: "Management Reports", path: "/reports", adminOnly: true },
  { icon: DatabaseBackup, title: "Backup and Restore", path: "/backup-restore", adminOnly: true },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const visibleItems = items.filter((item) => !item.adminOnly || currentUser?.is_superuser)

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
