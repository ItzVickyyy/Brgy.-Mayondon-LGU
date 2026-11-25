import type { ParseKeys } from "i18next"
import {
  Activity,
  BarChart3,
  BookUser,
  ChevronRight,
  CircleHelp,
  DatabaseBackup,
  FileCheck2,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { HelpDialog, WhatsNewDialog } from "@/components/Common/InfoDialogs"
import { Logo } from "@/components/Common/Logo"
import { SidebarBackdrop } from "@/components/Common/SidebarBackdrop"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

// Get help lives at the bottom of the menu, in reach on every page. It opens a small
// menu beside the button (Help, What's new). The pop-ups themselves are kept by
// AppSidebar, outside the menu: on a phone the menu closes when an item is chosen, and a
// pop-up inside it would close with it.
function HelpButton({
  onHelp,
  onWhatsNew,
}: {
  onHelp: () => void
  onWhatsNew: () => void
}) {
  const { t } = useTranslation()
  const { isMobile, setOpenMobile } = useSidebar()
  const choose = (open: () => void) => () => {
    if (isMobile) setOpenMobile(false)
    open()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              type="button"
              data-testid="sidebar-get-help"
              tooltip={t("userMenu.getHelp")}
              className={NAV_BUTTON_CLASS}
            >
              <CircleHelp aria-hidden="true" />
              <span className={NAV_LABEL_CLASS}>{t("userMenu.getHelp")}</span>
              <ChevronRight
                aria-hidden="true"
                className="ml-auto size-4 opacity-60 group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-testid="get-help-menu"
            className="w-52"
            side={isMobile ? "top" : "right"}
            align={isMobile ? "start" : "end"}
            sideOffset={10}
          >
            <DropdownMenuItem
              className="min-h-11 gap-2"
              onSelect={choose(onHelp)}
            >
              <CircleHelp className="size-4" aria-hidden="true" />
              {t("userMenu.help")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11 gap-2"
              onSelect={choose(onWhatsNew)}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {t("userMenu.whatsNew")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()
  const [helpOpen, setHelpOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
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
          <HelpButton
            onHelp={() => setHelpOpen(true)}
            onWhatsNew={() => setWhatsNewOpen(true)}
          />
        </SidebarFooter>
      </Sidebar>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <WhatsNewDialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen} />
    </>
  )
}

export default AppSidebar
