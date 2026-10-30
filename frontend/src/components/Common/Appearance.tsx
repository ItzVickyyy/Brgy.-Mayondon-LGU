import { Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export const SidebarAppearance = () => {
  const { setTheme, theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="Appearance"
        data-testid="theme-button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? (
          <Sun className="size-4 text-muted-foreground" />
        ) : (
          <Moon className="size-4 text-muted-foreground" />
        )}
        <span>{isDark ? "Light mode" : "Dark mode"}</span>
        <span className="sr-only">Switch theme</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export const Appearance = () => {
  const { setTheme, theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      data-testid="theme-button"
      variant="outline"
      size="icon"
      className="border-border bg-background/80 shadow-sm backdrop-blur"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      <span className="sr-only">
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </Button>
  )
}
