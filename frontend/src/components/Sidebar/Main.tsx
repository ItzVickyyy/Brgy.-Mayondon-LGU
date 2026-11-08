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

// Subtle navigation feedback: smooth colour change, the icon eases up a little
// on hover, and the current page gets a brand tint with a thin edge marker.
// Motion is switched off globally when the system asks for reduced motion.
const NAV_BUTTON_CLASS = [
  "relative transition-[width,height,padding,background-color,color]",
  "[&>svg]:transition-transform [&>svg]:duration-150 hover:[&>svg]:scale-110",
  "before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5",
  "before:-translate-y-1/2 before:rounded-full before:bg-brand before:opacity-0",
  "before:transition-opacity data-[active=true]:before:opacity-100",
  "data-[active=true]:bg-brand/10 data-[active=true]:text-brand",
  "data-[active=true]:hover:bg-brand/15 data-[active=true]:hover:text-brand",
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
                  <SidebarGroupLabel className="px-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
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
                      <span>{item.title}</span>
                      {item.badge !== undefined ? (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
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
