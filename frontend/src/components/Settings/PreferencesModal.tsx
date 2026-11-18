import { Check, Monitor, Moon, Sun } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePreferences } from "@/hooks/usePreferences"
import {
  ACCENT_CHROMA,
  ACCENT_HUES,
  ACCENTS,
  type Accent,
  FONT_SIZES,
  type FontSize,
} from "@/lib/preferences"
import { cn } from "@/lib/utils"

const choiceBase =
  "relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"

/** Real radio inputs (hidden) inside labels: native keyboard and screen-reader behaviour. */
function Group({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 w-full text-sm font-semibold text-brand">
        {label}
      </legend>
      <div className={cn("grid gap-2", className)}>{children}</div>
    </fieldset>
  )
}

function Choice({
  name,
  value,
  checked,
  onSelect,
  testId,
  className,
  children,
}: {
  name: string
  value: string
  checked: boolean
  onSelect: () => void
  testId: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn(choiceBase, className)}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        data-testid={testId}
        className="sr-only"
      />
      {children}
    </label>
  )
}

const SIZE_SAMPLE: Record<FontSize, string> = {
  small: "text-xs",
  medium: "text-sm",
  large: "text-base",
}

export function PreferencesModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const {
    preferences,
    theme,
    themeSetting,
    setTheme,
    setAccent,
    setFontSize,
    reset,
  } = usePreferences()

  // Swatches show the colour as it will look in the theme in use now.
  const swatchColor = (accent: Accent) =>
    theme === "dark"
      ? `oklch(0.5 ${0.14 * ACCENT_CHROMA[accent]} ${ACCENT_HUES[accent]})`
      : `oklch(0.36 ${0.1 * ACCENT_CHROMA[accent]} ${ACCENT_HUES[accent]})`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="preferences-modal"
        className={cn(modalShell, "sm:max-w-md")}
      >
        <DialogHeader className={modalHeader}>
          <DialogTitle>{t("preferences.title")}</DialogTitle>
          <DialogDescription>{t("preferences.description")}</DialogDescription>
        </DialogHeader>

        <div className={cn(modalBody, "space-y-6")}>
          <Group label={t("preferences.theme.label")} className="grid-cols-3">
            <Choice
              name="pref-theme"
              value="system"
              checked={themeSetting === "system"}
              onSelect={() => setTheme("system")}
              testId="pref-theme-system"
              className="px-1.5 text-center leading-tight"
            >
              <Monitor
                className="hidden size-4 shrink-0 sm:block"
                aria-hidden="true"
              />
              {t("preferences.theme.system")}
            </Choice>
            <Choice
              name="pref-theme"
              value="light"
              checked={themeSetting === "light"}
              onSelect={() => setTheme("light")}
              testId="pref-theme-light"
              className="px-1.5 text-center leading-tight"
            >
              <Sun
                className="hidden size-4 shrink-0 sm:block"
                aria-hidden="true"
              />
              {t("preferences.theme.light")}
            </Choice>
            <Choice
              name="pref-theme"
              value="dark"
              checked={themeSetting === "dark"}
              onSelect={() => setTheme("dark")}
              testId="pref-theme-dark"
              className="px-1.5 text-center leading-tight"
            >
              <Moon
                className="hidden size-4 shrink-0 sm:block"
                aria-hidden="true"
              />
              {t("preferences.theme.dark")}
            </Choice>
          </Group>

          <Group
            label={t("preferences.accent.label")}
            className="grid-cols-5 gap-1"
          >
            {ACCENTS.map((accent) => (
              <label
                key={accent}
                className="group flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-md px-0.5 py-1"
              >
                <input
                  type="radio"
                  name="pref-accent"
                  value={accent}
                  checked={preferences.accent === accent}
                  onChange={() => setAccent(accent)}
                  data-testid={`pref-accent-${accent}`}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: swatchColor(accent) }}
                  className="flex size-9 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background group-has-[:checked]:ring-2 group-has-[:checked]:ring-foreground group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-4 group-has-[:focus-visible]:outline-brand"
                >
                  <Check className="size-4 opacity-0 group-has-[:checked]:opacity-100" />
                </span>
                <span className="text-center text-xs leading-tight text-muted-foreground group-has-[:checked]:font-semibold group-has-[:checked]:text-foreground">
                  {t(`preferences.accent.${accent}`)}
                </span>
              </label>
            ))}
          </Group>

          <Group
            label={t("preferences.fontSize.label")}
            className="grid-cols-3"
          >
            {FONT_SIZES.map((size) => (
              <Choice
                key={size}
                name="pref-font-size"
                value={size}
                checked={preferences.fontSize === size}
                onSelect={() => setFontSize(size)}
                testId={`pref-size-${size}`}
              >
                <span className={SIZE_SAMPLE[size]}>
                  {t(`preferences.fontSize.${size}`)}
                </span>
              </Choice>
            ))}
          </Group>
        </div>

        <div className={cn(modalFooter, "flex justify-between gap-2")}>
          <Button type="button" variant="outline" onClick={reset}>
            {t("preferences.reset")}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("preferences.done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
