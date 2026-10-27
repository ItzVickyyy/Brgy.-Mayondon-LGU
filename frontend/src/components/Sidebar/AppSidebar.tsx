import { BookUser, CreditCard, FileCheck2, LayoutDashboard, Settings, Users, ShieldCheck, UserRound } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

type NavigationItem = Item & { adminOnly?: boolean }

const items: NavigationItem[] = [
  { icon: LayoutDashboard, title: "Dashboard", path: "/" },
  { icon: Users, title: "Resident Records", path: "/records" },
  { icon: FileCheck2, title: "Document Management", path: "/issuances" },
  { icon: CreditCard, title: "Barangay ID Management", path: "/barangay-ids" },
  { icon: UserRound, title: "My Account", path: "/my-account" },
  { icon: BookUser, title: "Officials", path: "/officials", adminOnly: true },
  { icon: ShieldCheck, title: "User Accounts", path: "/admin", adminOnly: true },
  { icon: Settings, title: "System Settings", path: "/settings", adminOnly: true },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const visibleItems = items.filter((item) => !item.adminOnly || currentUser?.is_superuser)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={visibleItems} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
