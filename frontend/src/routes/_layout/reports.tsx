import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileUp,
  X,
} from "lucide-react"
import { useState } from "react"

import { ReportsService } from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { NoPermission } from "@/components/Common/NoPermission"
import { StatCard } from "@/components/Common/StatCard"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  TablePagination,
  usePagination,
} from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export const Route = createFileRoute("/_layout/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: pageTitle("Management Reports") }] }),
})

type Period = "week" | "month" | "quarter" | "year"
type ReportType = "issuances" | "purpose" | "expiry" | "imports" | "accounts"

const periodLabel: Record<Period, string> = {
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
}

const kindLabel: Record<string, string> = {
  clearance: "Barangay Clearance",
  barangay_id: "Barangay ID",
}

const expiryStatusLabel: Record<string, string> = {
  expiring_soon: "Expiring soon",
  expired: "Expired",
}

const roleLabel: Record<string, string> = {
  admin: "System Administrator",
  staff: "Staff",
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
})

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
})

// Business dates ("YYYY-MM-DD") are formatted without time zones.
function formatReportDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return dateFormat.format(new Date(year, month - 1, day))
}

function formatMoment(value: string | null) {
  return value ? dateTimeFormat.format(new Date(value)) : "—"
}

function formatShare(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`
}

function formatChange(value: number | null) {
  if (value === null) return "—"
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

function daysText(daysLeft: number) {
  if (daysLeft === 0) return "expires today"
  if (daysLeft > 0) return `in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`
  const ago = Math.abs(daysLeft)
  return `expired ${ago} ${ago === 1 ? "day" : "days"} ago`
}

function Reports() {
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [period, setPeriod] = useState<Period>("month")
  const [report, setReport] = useState<ReportType>("issuances")
  // The report and period that were last previewed; null until Preview is clicked.
  const [applied, setApplied] = useState<{
    report: ReportType
    period: Period
  } | null>(null)
  const [notice, setNotice] = useState("")

  const summaryQuery = useQuery({
    queryKey: ["reports-summary", period],
    queryFn: async () =>
      (await ReportsService.summary({ query: { period } })).data,
    enabled: isAdmin,
  })

  const typeQuery = useQuery({
    queryKey: ["reports-issuances-by-type", applied?.period],
    queryFn: async () =>
      (
        await ReportsService.issuancesByType({
          query: { period: applied?.period },
        })
      ).data,
    enabled: isAdmin && applied?.report === "issuances",
  })

  const purposeQuery = useQuery({
    queryKey: ["reports-issuances-by-purpose", applied?.period],
    queryFn: async () =>
      (
        await ReportsService.issuancesByPurpose({
          query: { period: applied?.period },
        })
      ).data,
    enabled: isAdmin && applied?.report === "purpose",
  })

  // Expiring records are a snapshot as of today, so the period does not apply.
  const expiryQuery = useQuery({
    queryKey: ["reports-expiring"],
    queryFn: async () =>
      (
        await ReportsService.expiring({
          query: { status: "all", limit: 200 },
        })
      ).data,
    enabled: isAdmin && applied?.report === "expiry",
  })

  const accountQuery = useQuery({
    queryKey: ["reports-account-activity", applied?.period],
    queryFn: async () =>
      (
        await ReportsService.accountActivity({
          query: { period: applied?.period },
        })
      ).data,
    enabled: isAdmin && applied?.report === "accounts",
  })

  const typeRows = typeQuery.data?.data ?? []
  const purposeRows = purposeQuery.data?.data ?? []
  const expiringRows = expiryQuery.data?.data ?? []
  const accountRows = accountQuery.data?.data ?? []

  const resetKey = `${applied?.report}|${applied?.period}`
  const typePagination = usePagination(typeRows, 10, resetKey)
  const purposePagination = usePagination(purposeRows, 10, resetKey)
  const expiringPagination = usePagination(expiringRows, 10, resetKey)
  const accountPagination = usePagination(accountRows, 10, resetKey)

  if (!isAdmin) return <NoPermission />

  const appliedPeriodText = periodLabel[applied?.period ?? period]

  function previewReport() {
    setApplied({ report, period })
    setNotice("")
  }

  function buildCsvRows(): (string | number)[][] | null {
    if (!applied) return null
    if (applied.report === "issuances") {
      if (!typeQuery.data) return null
      return [
        ["Document type", "Issued", "Voided", "Share", "vs previous period"],
        ...typeRows.map((row) => [
          row.name,
          row.issued,
          row.voided,
          formatShare(row.share_percent),
          formatChange(row.change_percent),
        ]),
        [
          "Total",
          typeQuery.data.total_issued,
          typeQuery.data.total_voided,
          "",
          "",
        ],
      ]
    }
    if (applied.report === "purpose") {
      if (!purposeQuery.data) return null
      return [
        ["Purpose", "Issued", "Share"],
        ...purposeRows.map((row) => [
          row.purpose,
          row.issued,
          formatShare(row.share_percent),
        ]),
        ["Total", purposeQuery.data.total_issued, ""],
      ]
    }
    if (applied.report === "expiry") {
      if (!expiryQuery.data) return null
      return [
        ["Resident", "Record", "Reference", "Expires", "Status"],
        ...expiringRows.map((row) => [
          row.resident_name,
          kindLabel[row.kind] ?? row.kind,
          row.reference_no,
          formatReportDate(row.expires_on),
          expiryStatusLabel[row.status] ?? row.status,
        ]),
        ["Total", expiringRows.length, "records", "", ""],
      ]
    }
    if (applied.report === "accounts") {
      if (!accountQuery.data) return null
      return [
        [
          "User",
          "Role",
          "Documents issued",
          "Records added / edited",
          "Last activity",
        ],
        ...accountRows.map((row) => [
          row.full_name || row.email,
          roleLabel[row.role] ?? row.role,
          row.documents_issued,
          row.records_changed,
          formatMoment(row.last_activity),
        ]),
        [
          "Total",
          "",
          accountRows.reduce((total, row) => total + row.documents_issued, 0),
          accountRows.reduce((total, row) => total + row.records_changed, 0),
          "",
        ],
      ]
    }
    return null
  }

  function exportReport() {
    if (!applied) {
      setNotice("Preview a report before exporting.")
      return
    }
    if (applied.report === "imports") {
      setNotice(
        "Masterlist imports are not available yet, so there is nothing to export.",
      )
      return
    }
    const csvRows = buildCsvRows()
    if (!csvRows) {
      setNotice(
        "The report has not finished loading, so it cannot be exported yet.",
      )
      return
    }
    const csv = csvRows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `management-report-${applied.report}-${applied.period}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setNotice("CSV export started for the displayed report.")
  }

  function printReport() {
    if (!applied) {
      setNotice("Preview a report before printing.")
      return
    }
    window.print()
  }

  const th = "px-4 py-3 font-medium sm:px-5"
  const td = "px-4 py-3 sm:px-5"
  const thead =
    "bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"

  function renderResults() {
    if (!applied) {
      return (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <BarChart3
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-3 font-medium">Report preview area</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Results for the selected report will appear here.
          </p>
        </div>
      )
    }

    const loadFailed = (retry: () => void) => (
      <ErrorState
        title="Could not load this report"
        description="Check your connection and try again."
        onRetry={retry}
      />
    )

    if (applied.report === "issuances") {
      if (typeQuery.isLoading) return <LoadingState title="Loading report..." />
      if (typeQuery.isError || !typeQuery.data)
        return loadFailed(() => typeQuery.refetch())
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            Issuances by document type · {appliedPeriodText}
          </h3>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {[
                  "Document type",
                  "Issued",
                  "Voided",
                  "Share",
                  "vs previous period",
                ].map((label) => (
                  <th key={label} className={th}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {typePagination.paginatedItems.map((row) => (
                <tr
                  key={row.document_type_id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className={`${td} font-medium`}>{row.name}</td>
                  <td className={`${td} tabular-nums`}>{row.issued}</td>
                  <td className={`${td} tabular-nums`}>{row.voided}</td>
                  <td className={td}>{formatShare(row.share_percent)}</td>
                  <td className={td}>{formatChange(row.change_percent)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className={td}>Total</td>
                <td className={td}>{typeQuery.data.total_issued}</td>
                <td className={td}>{typeQuery.data.total_voided}</td>
                <td className={td}>—</td>
                <td className={td}>—</td>
              </tr>
            </tfoot>
          </table>
          {typeRows.length === 0 ? (
            <EmptyState
              title="No document-type data"
              description="No issuance records are available for this report."
            />
          ) : null}
          <TablePagination
            start={typePagination.start}
            end={typePagination.end}
            total={typePagination.total}
            pageIndex={typePagination.pageIndex}
            pageCount={typePagination.pageCount}
            onPageChange={typePagination.setPageIndex}
          />
        </div>
      )
    }

    if (applied.report === "purpose") {
      if (purposeQuery.isLoading)
        return <LoadingState title="Loading report..." />
      if (purposeQuery.isError || !purposeQuery.data)
        return loadFailed(() => purposeQuery.refetch())
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            Issuances by purpose · {appliedPeriodText}
          </h3>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {["Purpose", "Issued", "Share"].map((label) => (
                  <th key={label} className={th}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {purposePagination.paginatedItems.map((row) => (
                <tr
                  key={row.purpose_id ?? "none"}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className={`${td} font-medium`}>{row.purpose}</td>
                  <td className={`${td} tabular-nums`}>{row.issued}</td>
                  <td className={td}>{formatShare(row.share_percent)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className={td}>Total</td>
                <td className={td}>{purposeQuery.data.total_issued}</td>
                <td className={td}>—</td>
              </tr>
            </tfoot>
          </table>
          {purposeRows.length === 0 ? (
            <EmptyState
              title="No purpose data"
              description="No issuance purposes are available for this report."
            />
          ) : null}
          <TablePagination
            start={purposePagination.start}
            end={purposePagination.end}
            total={purposePagination.total}
            pageIndex={purposePagination.pageIndex}
            pageCount={purposePagination.pageCount}
            onPageChange={purposePagination.setPageIndex}
          />
        </div>
      )
    }

    if (applied.report === "expiry") {
      if (expiryQuery.isLoading)
        return <LoadingState title="Loading report..." />
      if (expiryQuery.isError || !expiryQuery.data)
        return loadFailed(() => expiryQuery.refetch())
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            Expiring records · as of today
          </h3>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {["Resident", "Record", "Reference", "Expires", "Status"].map(
                  (label) => (
                    <th key={label} className={th}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {expiringPagination.paginatedItems.map((row) => {
                const statusText = expiryStatusLabel[row.status] ?? row.status
                return (
                  <tr
                    key={row.issuance_id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className={`${td} font-semibold`}>
                      {row.resident_name}
                    </td>
                    <td className={td}>{kindLabel[row.kind] ?? row.kind}</td>
                    <td className={`${td} font-mono`}>{row.reference_no}</td>
                    <td className={td}>
                      <p>{formatReportDate(row.expires_on)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {daysText(row.days_left)}
                      </p>
                    </td>
                    <td className={td}>
                      <Badge
                        variant="outline"
                        className={statusStyles[statusText]}
                      >
                        {statusText}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className={td} colSpan={5}>
                  Total: {expiryQuery.data.count} records
                  {expiryQuery.data.count > expiringRows.length
                    ? ` (showing the first ${expiringRows.length})`
                    : ""}
                </td>
              </tr>
            </tfoot>
          </table>
          {expiringRows.length === 0 ? (
            <EmptyState
              title="No expiring records"
              description="There are no records to display for this report."
            />
          ) : null}
          <TablePagination
            start={expiringPagination.start}
            end={expiringPagination.end}
            total={expiringPagination.total}
            pageIndex={expiringPagination.pageIndex}
            pageCount={expiringPagination.pageCount}
            onPageChange={expiringPagination.setPageIndex}
          />
        </div>
      )
    }

    if (applied.report === "imports") {
      return (
        <EmptyState
          title="Masterlist imports are not available yet"
          description="Importing a masterlist has not been built, so there is no import history to report."
        />
      )
    }

    if (accountQuery.isLoading)
      return <LoadingState title="Loading report..." />
    if (accountQuery.isError || !accountQuery.data)
      return loadFailed(() => accountQuery.refetch())
    return (
      <div className="overflow-x-auto">
        <h3 className="mb-3 font-semibold tracking-tight">
          Account activity · {appliedPeriodText}
        </h3>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className={thead}>
            <tr>
              {[
                "User",
                "Role",
                "Documents issued",
                "Records added / edited",
                "Last activity",
              ].map((label) => (
                <th key={label} className={th}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {accountPagination.paginatedItems.map((row) => (
              <tr
                key={row.user_id}
                className="transition-colors hover:bg-muted/30"
              >
                <td className={td}>
                  <p className="font-semibold">{row.full_name || row.email}</p>
                  {row.full_name ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.email}
                    </p>
                  ) : null}
                </td>
                <td className={td}>
                  <Badge
                    variant="outline"
                    className={
                      row.role === "admin"
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : statusStyles.Inactive
                    }
                  >
                    {roleLabel[row.role] ?? row.role}
                  </Badge>
                </td>
                <td className={`${td} tabular-nums`}>{row.documents_issued}</td>
                <td className={`${td} tabular-nums`}>{row.records_changed}</td>
                <td className={td}>{formatMoment(row.last_activity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-semibold">
              <td className={td} colSpan={2}>
                Total
              </td>
              <td className={td}>
                {accountRows.reduce(
                  (total, row) => total + row.documents_issued,
                  0,
                )}
              </td>
              <td className={td}>
                {accountRows.reduce(
                  (total, row) => total + row.records_changed,
                  0,
                )}
              </td>
              <td className={td}>—</td>
            </tr>
          </tfoot>
        </table>
        {accountRows.length === 0 ? (
          <EmptyState
            title="No account activity"
            description="Account activity will appear here when records are available."
          />
        ) : null}
        <TablePagination
          start={accountPagination.start}
          end={accountPagination.end}
          total={accountPagination.total}
          pageIndex={accountPagination.pageIndex}
          pageCount={accountPagination.pageCount}
          onPageChange={accountPagination.setPageIndex}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Management Reports
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review document issuance and resident-record activity.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-brand"
            aria-hidden="true"
          />
          <p className="flex-1">{notice}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={FileCheck2}
          label="Documents Issued"
          value={summaryQuery.data?.documents_issued ?? "—"}
          description={periodLabel[period]}
        />
        <StatCard
          icon={Clock3}
          label="Records Expiring"
          value={summaryQuery.data?.records_expiring ?? "—"}
          description="Expiring soon or already expired"
        />
        <StatCard
          icon={FileUp}
          label="Masterlist Imports"
          value="—"
          description="Not connected yet"
        />
      </div>
      {summaryQuery.isError ? (
        <ErrorState
          title="Could not load the summary figures"
          onRetry={() => summaryQuery.refetch()}
        />
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">Generate a report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a report type and reporting period to preview aggregate
              results.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Report type
              <select
                value={report}
                onChange={(event) => {
                  setReport(event.target.value as ReportType)
                  setApplied(null)
                }}
                className={`${formControlClass} min-w-52 font-normal`}
              >
                <option value="issuances">Issuances by document type</option>
                <option value="purpose">Issuances by purpose</option>
                <option value="expiry">Expiring records</option>
                <option value="imports">Masterlist import summary</option>
                <option value="accounts">Account activity</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              Reporting period
              <select
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as Period)
                  setApplied(null)
                }}
                className={`${formControlClass} min-w-40 font-normal`}
              >
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
              </select>
            </label>
            <Button onClick={previewReport}>
              <BarChart3 aria-hidden="true" />
              Preview Report
            </Button>
            <Button variant="outline" onClick={exportReport}>
              <Download aria-hidden="true" />
              Export
            </Button>
            <Button variant="outline" onClick={printReport}>
              Print
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-5">{renderResults()}</div>
      </section>
    </div>
  )
}
