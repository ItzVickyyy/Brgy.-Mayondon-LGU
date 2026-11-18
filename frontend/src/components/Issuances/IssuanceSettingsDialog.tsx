import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  modalBody,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { CalibrationPanel } from "@/components/Issuances/CalibrationPanel"
import { LookupListSection } from "@/components/Records/LookupListsView"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { cn } from "@/lib/utils"

type SettingsTab = "printing" | "idType" | "sector" | "street" | "association" | "purpose"

const LIST_TABS: SettingsTab[] = ["idType", "sector", "street", "association", "purpose"]

/**
 * Issuance settings: Printing setup for everyone, plus the editable option lists
 * for administrators only. There is no Radix Tabs package in the project, so the
 * tab list is built by hand (buttons with role="tab").
 */
export function IssuanceSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [tab, setTab] = useState<SettingsTab>("printing")
  const tabs: SettingsTab[] = isAdmin
    ? ["printing", ...LIST_TABS]
    : ["printing"]
  const active = tabs.includes(tab) ? tab : "printing"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(modalShell, "sm:max-w-3xl")}
        data-testid="issuance-settings"
      >
        <DialogHeader className={modalHeader}>
          <DialogTitle>{t("issuances.settings.title")}</DialogTitle>
          <DialogDescription>
            {t(
              isAdmin
                ? "issuances.settings.description"
                : "issuances.settings.descriptionStaff",
            )}
          </DialogDescription>
        </DialogHeader>
        {tabs.length > 1 && (
          <div
            role="tablist"
            aria-label={t("issuances.settings.title")}
            className="flex gap-1 overflow-x-auto border-b px-3 sm:px-4"
          >
            {tabs.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`settings-tab-${name}`}
                aria-selected={active === name}
                aria-controls="settings-panel"
                data-testid={`settings-tab-${name}`}
                onClick={() => setTab(name)}
                className={cn(
                  "min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === name
                    ? "border-primary text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`issuances.settings.tabs.${name}`)}
              </button>
            ))}
          </div>
        )}
        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={`settings-tab-${active}`}
          className={modalBody}
        >
          {active === "printing" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t("issuances.printSetup.description")}
              </p>
              <CalibrationPanel />
            </div>
          ) : (
            <LookupListSection kind={active} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
