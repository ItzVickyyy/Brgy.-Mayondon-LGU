import type { ParseKeys } from "i18next"
import {
  Activity,
  BarChart3,
  BookUser,
  DatabaseBackup,
  FileCheck2,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { Logo } from "@/components/Common/Logo"
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { type Item, Main } from "./Main"

type TranslationKey = ParseKeys

type NavigationItem = Omit<Item, "title" | "section"> & {
  titleKey: TranslationKey
  sectionKey: TranslationKey
  adminOnly?: boolean
}

const items: NavigationItem[] = [
  {
    icon: LayoutDashboard,
    titleKey: "nav.dashboard",
    hue: 235,
    path: "/",
    sectionKey: "nav.sections.workspace",
  },
  {
    icon: Activity,
    titleKey: "nav.activityLog",
    hue: 300,
    path: "/activity-log",
    sectionKey: "nav.sections.workspace",
  },
  {
    icon: FileCheck2,
    titleKey: "nav.issuances",
    hue: 160,
    path: "/issuances",
    sectionKey: "nav.sections.recordsAndDocuments",
  },
  {
    icon: Users,
    titleKey: "nav.records",
    hue: 80,
    path: "/records",
    sectionKey: "nav.sections.recordsAndDocuments",
  },
  {
    icon: BookUser,
    titleKey: "nav.officials",
    hue: 10,
    path: "/officials",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
  {
    icon: ShieldCheck,
    titleKey: "nav.userAccounts",
    hue: 195,
    path: "/admin",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
  {
    icon: BarChart3,
    titleKey: "nav.reports",
    hue: 50,
    path: "/reports",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
  {
    icon: DatabaseBackup,
    titleKey: "nav.backupRestore",
    hue: 270,
    path: "/backup-restore",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()
  const visibleItems: Item[] = items
    .filter((item) => !item.adminOnly || isSystemAdministrator(currentUser))
    .map(({ titleKey, sectionKey, ...item }) => ({
      ...item,
      title: t(titleKey),
      section: t(sectionKey),
    }))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 min-h-16 justify-center overflow-hidden border-b border-sidebar-border px-4 py-2 transition-[padding] duration-300 ease-sidebar group-data-[collapsible=icon]:px-2">
        <Logo variant="responsive" tone="sidebar" />
      </SidebarHeader>
      <SidebarContent className="pt-3">
        <Main items={visibleItems} />
      </SidebarContent>
    </Sidebar>
  )
}

export default AppSidebar
