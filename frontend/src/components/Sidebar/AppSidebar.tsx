import type { ParseKeys } from "i18next"
import {
  Activity,
  BarChart3,
  BookUser,
  CircleHelp,
  DatabaseBackup,
  FileCheck2,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { HelpDialog } from "@/components/Common/InfoDialogs"
import { Logo } from "@/components/Common/Logo"
import { SidebarBackdrop } from "@/components/Common/SidebarBackdrop"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { type Item, Main, NAV_BUTTON_CLASS, NAV_LABEL_CLASS } from "./Main"

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
    path: "/",
    sectionKey: "nav.sections.workspace",
  },
  {
    icon: Activity,
    titleKey: "nav.activityLog",
    path: "/activity-log",
    sectionKey: "nav.sections.workspace",
  },
  {
    icon: FileCheck2,
    titleKey: "nav.issuances",
    path: "/issuances",
    sectionKey: "nav.sections.recordsAndDocuments",
  },
  {
    icon: Users,
    titleKey: "nav.records",
    path: "/records",
    sectionKey: "nav.sections.recordsAndDocuments",
  },
  {
    icon: BookUser,
    titleKey: "nav.officials",
    path: "/officials",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
  {
    icon: ShieldCheck,
    titleKey: "nav.userAccounts",
    path: "/admin",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
  {
    icon: BarChart3,
    titleKey: "nav.reports",
    path: "/reports",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
  {
    icon: DatabaseBackup,
    titleKey: "nav.backupRestore",
    path: "/backup-restore",
    adminOnly: true,
    sectionKey: "nav.sections.administration",
  },
]

// Get help lives at the bottom of the menu, in reach on every page. The pop-up itself
// is kept by AppSidebar, outside the menu: on a phone the menu closes when this button
// is pressed, and a pop-up inside it would close with it.
function HelpButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          type="button"
          data-testid="sidebar-get-help"
          tooltip={t("userMenu.getHelp")}
          className={NAV_BUTTON_CLASS}
          onClick={() => {
            if (isMobile) setOpenMobile(false)
            onOpen()
          }}
        >
          <CircleHelp aria-hidden="true" />
          <span className={NAV_LABEL_CLASS}>{t("userMenu.getHelp")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()
  const [helpOpen, setHelpOpen] = useState(false)
  const visibleItems: Item[] = items
    .filter((item) => !item.adminOnly || isSystemAdministrator(currentUser))
    .map(({ titleKey, sectionKey, ...item }) => ({
      ...item,
      title: t(titleKey),
      section: t(sectionKey),
    }))

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarBackdrop />
        <SidebarHeader className="relative h-16 min-h-16 justify-center overflow-hidden border-b border-sidebar-border px-4 py-2 transition-[padding] duration-300 ease-sidebar group-data-[collapsible=icon]:px-2">
          <Logo variant="responsive" tone="sidebar" />
        </SidebarHeader>
        <SidebarContent className="relative pt-3">
          <Main items={visibleItems} />
        </SidebarContent>
        <SidebarFooter className="relative border-t border-sidebar-border p-2">
          <HelpButton onOpen={() => setHelpOpen(true)} />
        </SidebarFooter>
      </Sidebar>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  )
}

export default AppSidebar
