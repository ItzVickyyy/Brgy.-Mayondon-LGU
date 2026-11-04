import { createFileRoute } from "@tanstack/react-router"
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/Common/FeedbackState"
import { NoPermission } from "@/components/Common/NoPermission"
import { StatCard } from "@/components/Common/StatCard"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export const Route = createFileRoute("/_layout/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: pageTitle("Management Reports") }] }),
})

const summary = []

const documentTypeRows = []

const purposeRows = []

const expiringRows = []

const importRows = []

const accountActivityRows = []

function formatReportDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
}

function Reports() {
  const { user } = useAuth()
  const [period, setPeriod] = useState("month")
  const [report, setReport] = useState("issuances")
  const [notice, setNotice] = useState("")
  const [generated, setGenerated] = useState(false)
  const [importResultsOpen, setImportResultsOpen] = useState(false)

  if (!isSystemAdministrator(user)) return <NoPermission />

  const periodLabel: Record<string, string> = {
    week: "This week",
    month: "This month",
    quarter: "This quarter",
    year: "This year",
  }

  function previewReport() {
    setGenerated(true)
    setNotice(`Previewing ${report} for ${periodLabel[period].toLowerCase()}.`)
  }

  function exportReport() {
    if (!generated) {
      setNotice("Preview a report before exporting.")
      return
    }
    if (period === "week") {
      setNotice("No activity in this period to export.")
      return
    }
    let csvRows: (string | number)[][]
    if (report === "issuances") {
      csvRows = [
        ["Document type", "Issued", "Voided", "Share", "vs previous period"],
        ...documentTypeRows.map((row) => [row.document, row.issued, row.voided, row.share, row.change]),
        ["Total", 128, 4, "100%", "+12%"],
      ]
    } else if (report === "purpose") {
      csvRows = [
        ["Purpose", "Issued", "Share"],
        ...purposeRows.slice().sort((a, b) => b.issued - a.issued).map((row) => [row.purpose, row.issued, row.share]),
        ["Total", 128, "100%"],
      ]
    } else if (report === "expiry") {
      csvRows = [
        ["Resident", "Record", "Reference", "Expires", "Status"],
        ...expiringRows.map((row) => [row.resident, row.record, row.reference, formatReportDate(row.expires), row.status]),
        ["Total", expiringRows.length, "records", "", ""],
      ]
    } else if (report === "imports") {
      csvRows = [
        ["Date", "File", "Imported by", "Imported", "Updated", "Skipped", "Failed"],
        ...importRows.map((row) => [row.date, row.file, row.importedBy, row.imported, row.updated, row.skipped, row.failed]),
        ["Total", "", "", 246, 12, 3, 2],
      ]
    } else {
      csvRows = [
        ["User", "Role", "Sign-ins", "Documents issued", "Records added / edited", "Last activity"],
        ...accountActivityRows.map((row) => [row.user, row.role, row.signIns, row.documents, row.records, row.lastActivity]),
        ["Total", "", 42, 80, 20, ""],
      ]
    }
    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `management-report-${report}-${period}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setNotice("CSV export started for the displayed report.")
  }

  function printReport() {
    if (!generated) {
      setNotice("Preview a report before printing.")
      return
    }
    window.print()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Management Reports</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review document issuance and resident-record activity.
          </p>
        </div>
      </div>

      {notice ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="icon" onClick={() => setNotice("")} aria-label="Dismiss message"><X aria-hidden="true" /></Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => <StatCard key={item.label} icon={item.icon} label={item.label} value={item.value} description={item.note} />)}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">Generate a report</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a report type and reporting period to preview aggregate results.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Report type
              <select value={report} onChange={(event) => { setReport(event.target.value); setGenerated(false) }} className={`${formControlClass} min-w-52 font-normal`}>
                <option value="issuances">Issuances by document type</option>
                <option value="purpose">Issuances by purpose</option>
                <option value="expiry">Expiring records</option>
                <option value="imports">Masterlist import summary</option>
                <option value="accounts">Account activity</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Reporting period
              <select value={period} onChange={(event) => { setPeriod(event.target.value); setGenerated(false) }} className={`${formControlClass} min-w-40 font-normal`}>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
              </select>
            </label>
            <Button onClick={previewReport}><BarChart3 aria-hidden="true" />Preview Report</Button>
            <Button variant="outline" onClick={exportReport}><Download aria-hidden="true" />Export</Button>
            <Button variant="outline" onClick={printReport}>Print</Button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {!generated ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <BarChart3 className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">Report preview area</p>
              <p className="mt-1 text-sm text-muted-foreground">Results for the selected report will appear here.</p>
            </div>
          ) : period === "week" ? (
            <EmptyState title="No activity in this period" description="No records fall within the selected week." />
          ) : report === "issuances" ? (
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold tracking-tight">Issuances by document type · {periodLabel[period]}</h3>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Document type", "Issued", "Voided", "Share", "vs previous period"].map((label) => <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 font-medium sm:px-5"}>{label}</th>)}</tr></thead>
                <tbody className="divide-y">{documentTypeRows.map((row) => <tr key={row.document} className="transition-colors hover:bg-muted/30"><td className="px-4 py-3 font-medium sm:px-5">{row.document}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.issued}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.voided}</td><td className="px-4 py-3 sm:px-5">{row.share}</td><td className="px-4 py-3 sm:px-5">{row.change}</td></tr>)}</tbody>
                <tfoot><tr className="border-t bg-muted/30 font-semibold"><td className="px-4 py-3 sm:px-5">Total</td><td className="px-4 py-3 sm:px-5">{documentTypeRows.reduce((total, row) => total + row.issued, 0)}</td><td className="px-4 py-3 sm:px-5">{documentTypeRows.reduce((total, row) => total + row.voided, 0)}</td><td className="px-4 py-3 sm:px-5">—</td><td className="px-4 py-3 sm:px-5">—</td></tr></tfoot>
              </table>
            </div>
          ) : report === "purpose" ? (
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold tracking-tight">Issuances by purpose · {periodLabel[period]}</h3>
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Purpose", "Issued", "Share"].map((label) => <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 font-medium sm:px-5"}>{label}</th>)}</tr></thead>
                <tbody className="divide-y">{purposeRows.slice().sort((a, b) => b.issued - a.issued).map((row) => <tr key={row.purpose} className="transition-colors hover:bg-muted/30"><td className="px-4 py-3 font-medium sm:px-5">{row.purpose}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.issued}</td><td className="px-4 py-3 sm:px-5">{row.share}</td></tr>)}</tbody>
                <tfoot><tr className="border-t bg-muted/30 font-semibold"><td className="px-4 py-3 sm:px-5">Total</td><td className="px-4 py-3 sm:px-5">{purposeRows.reduce((total, row) => total + row.issued, 0)}</td><td className="px-4 py-3 sm:px-5">—</td></tr></tfoot>
              </table>
            </div>
          ) : report === "expiry" ? (
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold tracking-tight">Expiring records · {periodLabel[period]}</h3>
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Resident", "Record", "Reference", "Expires", "Status", "Actions"].map((label) => <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 font-medium sm:px-5"}>{label}</th>)}</tr></thead>
                <tbody className="divide-y">{expiringRows.map((row) => <tr key={row.reference} className="transition-colors hover:bg-muted/30"><td className="px-4 py-3 font-semibold sm:px-5">{row.resident}</td><td className="px-4 py-3 sm:px-5">{row.record}</td><td className="px-4 py-3 font-mono sm:px-5">{row.reference}</td><td className="px-4 py-3 sm:px-5"><p>{formatReportDate(row.expires)}</p><p className="mt-1 text-xs text-muted-foreground">{row.days >= 0 ? `in ${row.days} days` : `expired ${Math.abs(row.days)} days ago`}</p></td><td className="px-4 py-3 sm:px-5"><Badge variant="outline" className={statusStyles[row.status]}>{row.status}</Badge></td><td className="px-4 py-3 sm:px-5"><Button variant="outline" size="sm" asChild><a href={row.href}>Open record</a></Button></td></tr>)}</tbody>
                <tfoot><tr className="border-t bg-muted/30 font-semibold"><td className="px-4 py-3 sm:px-5" colSpan={6}>Total: {expiringRows.length} records</td></tr></tfoot>
              </table>
            </div>
          ) : report === "imports" ? (
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold tracking-tight">Masterlist import summary · {periodLabel[period]}</h3>
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Date", "File", "Imported by", "Imported", "Updated", "Skipped", "Failed", "Actions"].map((label) => <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 font-medium sm:px-5"}>{label}</th>)}</tr></thead>
                <tbody className="divide-y">{importRows.map((row) => <tr key={row.file} className="transition-colors hover:bg-muted/30"><td className="whitespace-nowrap px-4 py-3 sm:px-5">{row.date}</td><td className="px-4 py-3 font-mono sm:px-5">{row.file}</td><td className="px-4 py-3 sm:px-5">{row.importedBy}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.imported}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.updated}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.skipped}</td><td className={`px-4 py-3 tabular-nums sm:px-5 ${row.failed > 0 ? "font-semibold text-destructive" : ""}`}>{row.failed}</td><td className="px-4 py-3 sm:px-5"><Button variant="outline" size="sm" onClick={() => setImportResultsOpen(true)}>View results</Button></td></tr>)}</tbody>
                <tfoot><tr className="border-t bg-muted/30 font-semibold"><td className="px-4 py-3 sm:px-5" colSpan={3}>Total</td><td className="px-4 py-3 sm:px-5">{importRows.reduce((total, row) => total + row.imported, 0)}</td><td className="px-4 py-3 sm:px-5">{importRows.reduce((total, row) => total + row.updated, 0)}</td><td className="px-4 py-3 sm:px-5">{importRows.reduce((total, row) => total + row.skipped, 0)}</td><td className="px-4 py-3 sm:px-5">{importRows.reduce((total, row) => total + row.failed, 0)}</td><td className="px-4 py-3 sm:px-5">—</td></tr></tfoot>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold tracking-tight">Account activity · {periodLabel[period]}</h3>
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["User", "Role", "Sign-ins", "Documents issued", "Records added / edited", "Last activity", "Actions"].map((label) => <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 font-medium sm:px-5"}>{label}</th>)}</tr></thead>
                <tbody className="divide-y">{accountActivityRows.map((row) => <tr key={row.user} className="transition-colors hover:bg-muted/30"><td className="px-4 py-3 font-semibold sm:px-5">{row.user}</td><td className="px-4 py-3 sm:px-5"><Badge variant="outline" className={row.role === "System Administrator" ? "border-primary/30 bg-primary/10 text-primary" : statusStyles.Inactive}>{row.role}</Badge></td><td className="px-4 py-3 tabular-nums sm:px-5">{row.signIns}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.documents}</td><td className="px-4 py-3 tabular-nums sm:px-5">{row.records}</td><td className="px-4 py-3 sm:px-5">{row.lastActivity}</td><td className="px-4 py-3 sm:px-5"><Button variant="outline" size="sm" asChild><a href={`/activity-log?user=${encodeURIComponent(row.user)}&period=${period}`}>View in Activity Log</a></Button></td></tr>)}</tbody>
                <tfoot><tr className="border-t bg-muted/30 font-semibold"><td className="px-4 py-3 sm:px-5" colSpan={2}>Total</td><td className="px-4 py-3 sm:px-5">{accountActivityRows.reduce((total, row) => total + row.signIns, 0)}</td><td className="px-4 py-3 sm:px-5">{accountActivityRows.reduce((total, row) => total + row.documents, 0)}</td><td className="px-4 py-3 sm:px-5">{accountActivityRows.reduce((total, row) => total + row.records, 0)}</td><td className="px-4 py-3 sm:px-5">—</td><td className="px-4 py-3 sm:px-5">—</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      </section>

      <Dialog open={importResultsOpen} onOpenChange={setImportResultsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Masterlist import results</DialogTitle>
            <DialogDescription>Validation issues found during the selected import.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Row</th><th className="px-4 py-3 font-medium">Issue</th></tr></thead>
              <tbody className="divide-y"><tr><td className="px-4 py-3 text-muted-foreground" colSpan={2}>No import results are available.</td></tr></tbody>
            </table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setImportResultsOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
