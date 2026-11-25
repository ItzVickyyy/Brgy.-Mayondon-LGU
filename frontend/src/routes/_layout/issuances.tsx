import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus, Settings2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { IssuanceHistory } from "@/components/Issuances/IssuanceHistory"
import { IssuanceSettingsDialog } from "@/components/Issuances/IssuanceSettingsDialog"
import { type DocumentCode, documentConfig } from "@/components/Issuances/NewIssuance/documentConfig"
import { NewIssuanceDialog } from "@/components/Issuances/NewIssuance/NewIssuanceDialog"
import { usePrintIssuance } from "@/components/Issuances/usePrintIssuance"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import { notify } from "@/lib/notifications"

export const Route = createFileRoute("/_layout/issuances")({
  component: IssuancesManagement,
  // Keep every param; only `new` is typed so the Dashboard can link with it.
  validateSearch: (search: Record<string, unknown>): { new?: 1 } => ({
    ...search,
    ...(search.new === 1 || search.new === "1" ? { new: 1 as const } : {}),
  }),
  head: () => ({ meta: [{ title: pageTitle("Issuances Management") }] }),
})

function getPreselectedResident() {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("resident") ?? ""
}

function getPreselectedType(): DocumentCode | undefined {
  if (typeof window === "undefined") return undefined
  const type = new URLSearchParams(window.location.search).get("type") ?? ""
  return type in documentConfig ? (type as DocumentCode) : undefined
}

function IssuancesManagement() {
  const { t } = useTranslation()
  // The Dashboard "Issue Document" button arrives here with ?new=1.
  const { new: openNew } = Route.useSearch()
  const [isSimplifiedDialogOpen, setIsSimplifiedDialogOpen] = useState(
    () => Boolean(getPreselectedResident()) || openNew === 1,
  )
  const [initialDraftId, setInitialDraftId] = useState("")
  const queryClient = useQueryClient()
  const [printSetupOpen, setPrintSetupOpen] = useState(false)
  const { print: printStoredIssuance, overlay: printOverlay } = usePrintIssuance()

  return (
    <div className="flex flex-col gap-6">
      <style>
        {
          "@media print { body * { visibility: hidden !important; } }"
        }
      </style>

      {/* Page header */}
      <header className="print:hidden flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title relative mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("issuances.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("issuances.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setPrintSetupOpen(true)}>
            <Settings2 aria-hidden="true" />
            {t("issuances.settingsButton")}
          </Button>
          <Button
            variant="cta"
            size="cta"
            className="w-full sm:w-auto"
            data-shortcut="new-issuance"
            title={t("common.dialogs.shortcutHint", { key: "N" })}
            onClick={() => setIsSimplifiedDialogOpen(true)}
          >
            <Plus aria-hidden="true" />
            {t("issuances.newIssuance")}
          </Button>
        </div>
      </header>


      <NewIssuanceDialog
        open={isSimplifiedDialogOpen}
        onOpenChange={(next) => {
          setIsSimplifiedDialogOpen(next)
          if (!next) setInitialDraftId("")
          if (!next && typeof window !== "undefined") {
            // Drop ?resident=, ?type= and ?new= so the next "New Issuance" opens blank.
            const params = new URLSearchParams(window.location.search)
            if (params.has("resident") || params.has("type") || params.has("new")) {
              params.delete("new")
              params.delete("resident")
              params.delete("type")
              const query = params.toString()
              window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
            }
          }
        }}
        initialResidentId={getPreselectedResident()}
        initialDocumentType={getPreselectedType()}
        initialDraftId={initialDraftId || undefined}
        onDraftRemoved={() => { void queryClient.invalidateQueries({ queryKey: ["issuances"] }) }}
        onPrint={(record) => printStoredIssuance(record.id)}
        onSaved={(record, meta) => {
          // The history list reads the server, so refresh it instead of building rows here.
          for (const key of ["issuances", "issuances-summary", "barangay-ids", "barangay-id-count", "dashboard", "residents"]) {
            void queryClient.invalidateQueries({ queryKey: [key] })
          }
          if (meta?.auto) return
          if (record.status !== "draft") notify({ key: "issuances.noticeIssued", values: { ref: record.referenceNo } })
          else if (record.referenceNo === "Draft") notify({ key: "issuances.noticeDraftPlain" })
          else notify({ key: "issuances.noticeDraft", values: { ref: record.referenceNo } })
        }}
      />

      <IssuanceHistory
        onNotice={notify}
        onContinueDraft={(id) => {
          setInitialDraftId(id)
          setIsSimplifiedDialogOpen(true)
        }}
        onPrint={async (item, mode) => {
          const message = await printStoredIssuance(item.id, mode)
          // Only "opened the print dialog" is good news; every other answer
          // (busy, not found, voided, no template, not recorded) is a warning.
          if (message && message !== t("issuances.printing.notices.opened")) {
            notify(message, "warning")
            return ""
          }
          return message
        }}
      />

      <IssuanceSettingsDialog open={printSetupOpen} onOpenChange={setPrintSetupOpen} />
      {printOverlay}
    </div>
  )
}
