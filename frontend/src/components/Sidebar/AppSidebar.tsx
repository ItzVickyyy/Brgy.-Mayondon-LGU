import { BookUser, FileCheck2, House, LayoutDashboard, Settings, Users, ShieldCheck } from "lucide-react"

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

const items: Item[] = [
  { icon: LayoutDashboard, title: "Dashboard", path: "/" },
  { icon: FileCheck2, title: "Issuances Management", path: "/issuances" },
  { icon: Users, title: "Records Management", path: "/records" },
  { icon: BookUser, title: "Officials", path: "/officials" },
  { icon: ShieldCheck, title: "User Management", path: "/admin" },
  { icon: Settings, title: "System Settings", path: "/settings" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
