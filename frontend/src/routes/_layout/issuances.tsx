import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, Plus, Settings2, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CalibrationPanel } from "@/components/Issuances/CalibrationPanel"
import { IssuanceHistory } from "@/components/Issuances/IssuanceHistory"
import { NewIssuanceDialog } from "@/components/Issuances/NewIssuance/NewIssuanceDialog"
import { type DocumentCode, documentConfig } from "@/components/Issuances/NewIssuance/documentConfig"
import { usePrintIssuance } from "@/components/Issuances/usePrintIssuance"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/issuances")({
  component: IssuancesManagement,
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
  const [isSimplifiedDialogOpen, setIsSimplifiedDialogOpen] = useState(() => Boolean(getPreselectedResident()))
  const [initialDraftId, setInitialDraftId] = useState("")
  const queryClient = useQueryClient()
  const [printSetupOpen, setPrintSetupOpen] = useState(false)
  const { print: printStoredIssuance, overlay: printOverlay } = usePrintIssuance()
  const [notice, setNotice] = useState("")

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
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("issuances.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("issuances.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setPrintSetupOpen(true)}>
            <Settings2 aria-hidden="true" />
            {t("issuances.printingSetup")}
          </Button>
          <Button
            size="default"
            className="min-h-11 w-full sm:w-auto"
            data-shortcut="new-issuance"
            onClick={() => setIsSimplifiedDialogOpen(true)}
          >
            <Plus aria-hidden="true" />
            {t("issuances.newIssuance")}
          </Button>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className="print:hidden flex items-start gap-3 rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-brand"
            aria-hidden="true"
          />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="icon" className="size-11" onClick={() => setNotice("")} aria-label={t("issuances.dismissMessage")}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      <NewIssuanceDialog
        open={isSimplifiedDialogOpen}
        onOpenChange={(next) => {
          setIsSimplifiedDialogOpen(next)
          if (!next) setInitialDraftId("")
          if (!next && typeof window !== "undefined") {
            // Drop ?resident= and ?type= so the next "New Issuance" opens blank.
            const params = new URLSearchParams(window.location.search)
            if (params.has("resident") || params.has("type")) {
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
          setNotice(record.status === "draft" ? `${record.referenceNo === "Draft" ? "The draft" : record.referenceNo} was saved as a draft.` : `${record.referenceNo} was recorded as issued.`)
        }}
      />

      <IssuanceHistory
        onNotice={setNotice}
        onContinueDraft={(id) => {
          setInitialDraftId(id)
          setIsSimplifiedDialogOpen(true)
        }}
        onPrint={(item) => printStoredIssuance(item.id)}
      />

      <Dialog open={printSetupOpen} onOpenChange={setPrintSetupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("issuances.printSetup.title")}</DialogTitle>
            <DialogDescription>{t("issuances.printSetup.description")}</DialogDescription>
          </DialogHeader>
          <CalibrationPanel />
        </DialogContent>
      </Dialog>
      {printOverlay}

      {printOverlay}
    </div>
  )
}
