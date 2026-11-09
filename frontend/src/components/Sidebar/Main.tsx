import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import { Fragment } from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type Item = {
  icon: LucideIcon
  title: string
  path: string
  section?: string
  badge?: number | string
}

interface MainProps {
  items: Item[]
}

// Formal, uncoloured buttons: quiet light text and icons on the solid navy
// panel. The current page gets a soft white band, white semibold text and a
// thin gold marker on its left edge; nothing else is coloured.
// The sidebar is always dark, so text uses the --sidebar-* tokens.
// Width is not transitioned here on purpose: the button simply follows the
// sidebar as it opens and closes, so the highlight never snaps ahead of it.
// Motion is switched off globally when the system asks for reduced motion.
const NAV_BUTTON_CLASS = [
  "relative rounded-md transition-[background-color,color]",
  "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px]",
  "before:-translate-y-1/2 before:rounded-r-sm before:bg-sidebar-primary before:opacity-0",
  "before:transition-opacity data-[active=true]:before:opacity-100",
  "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
  "data-[active=true]:font-semibold",
].join(" ")

// The label keeps the width it has when the sidebar is open (sidebar width
// minus the paddings, icon and gap), so while the sidebar slides it is clipped
// rather than re-truncated with an ellipsis. It fades out first when closing
// and fades in last when opening.
const NAV_LABEL_CLASS = [
  "block w-[calc(var(--sidebar-width)-3.5rem)] shrink-0 truncate whitespace-nowrap",
  "transition-opacity duration-150 ease-out",
  "group-data-[collapsible=icon]:opacity-0",
  "group-data-[state=expanded]:delay-150",
].join(" ")

export function Main({ items }: MainProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item, index) => {
            const isActive = currentPath === item.path
            const showSection = Boolean(
              item.section && item.section !== items[index - 1]?.section,
            )

            return (
              <Fragment key={item.title}>
                {showSection ? (
                  <SidebarGroupLabel className="px-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/55 [transition-duration:300ms,150ms] group-data-[state=expanded]:[transition-delay:0ms,150ms]">
                    {item.section}
                  </SidebarGroupLabel>
                ) : null}
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive}
                    className={NAV_BUTTON_CLASS}
                    asChild
                  >
                    <RouterLink to={item.path} onClick={handleMenuClick}>
                      <item.icon />
                      <span className={NAV_LABEL_CLASS}>{item.title}</span>
                      {item.badge !== undefined ? (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 py-0.5 text-xs font-semibold text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
                          {item.badge}
                        </span>
                      ) : null}
                    </RouterLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </Fragment>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
