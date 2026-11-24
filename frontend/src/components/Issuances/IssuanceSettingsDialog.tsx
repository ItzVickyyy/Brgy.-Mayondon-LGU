import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  modalBody,
  modalHeader,
  modalShell,
  modalTall,
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
import { cn } from "@/lib/utils"

type SettingsTab =
  | "printing"
  | "idType"
  | "sector"
  | "street"
  | "subdivision"
  | "association"
  | "purpose"
  | "addressedOffice"
  | "educationalAttainment"

const LIST_TABS: SettingsTab[] = [
  "idType",
  "sector",
  "street",
  "subdivision",
  "association",
  "purpose",
  "addressedOffice",
  "educationalAttainment",
]

/**
 * Issuance settings: Printing setup plus the editable option lists,
 * for administrators and staff alike. There is no Radix Tabs package in the project, so the
 * tab list is built by hand (buttons with role="tab"): a left sidebar from
 * `sm` up, a sideways strip on a phone.
 */
export function IssuanceSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<SettingsTab>("printing")
  const tabs: SettingsTab[] = ["printing", ...LIST_TABS]
  const active = tabs.includes(tab) ? tab : "printing"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(modalShell, modalTall, "sm:max-w-6xl")}
        data-testid="issuance-settings"
      >
        <DialogHeader className={modalHeader}>
          <DialogTitle>{t("issuances.settings.title")}</DialogTitle>
          <DialogDescription>
            {t("issuances.settings.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={t("issuances.settings.title")}
            className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 sm:w-64 sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden sm:border-r sm:border-b-0 sm:bg-muted/30 sm:p-3"
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
                  "min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-full sm:rounded-md sm:border-b-0 sm:border-l-2 sm:py-2 sm:text-left",
                  active === name
                    ? "border-primary text-brand sm:bg-background sm:shadow-xs"
                    : "border-transparent text-muted-foreground hover:text-foreground sm:hover:bg-muted",
                )}
              >
                {t(`issuances.settings.tabs.${name}`)}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="settings-panel"
            aria-labelledby={`settings-tab-${active}`}
            className={cn(modalBody, "min-w-0")}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
