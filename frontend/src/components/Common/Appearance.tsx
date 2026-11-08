import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export const SidebarAppearance = () => {
  const { t } = useTranslation()
  const { setTheme, theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={t("common.ui.appearance")}
        data-testid="theme-button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? (
          <Sun className="size-4 text-muted-foreground" />
        ) : (
          <Moon className="size-4 text-muted-foreground" />
        )}
        <span>
          {isDark ? t("common.ui.lightShort") : t("common.ui.darkShort")}
        </span>
        <span className="sr-only">{t("common.ui.switchTheme")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export const Appearance = () => {
  const { t } = useTranslation()
  const { setTheme, theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      data-testid="theme-button"
      variant="outline"
      size="icon"
      className="border-border bg-background/80 shadow-sm backdrop-blur"
      aria-label={isDark ? t("common.ui.lightMode") : t("common.ui.darkMode")}
      title={isDark ? t("common.ui.lightMode") : t("common.ui.darkMode")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="sr-only">
        {isDark ? t("common.ui.lightMode") : t("common.ui.darkMode")}
      </span>
    </Button>
  )
}
