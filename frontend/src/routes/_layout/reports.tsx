import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ParseKeys, TFunction } from "i18next"
import {
  BarChart3,
  Clock3,
  Download,
  FileCheck2,
  FileUp,
  Printer,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type DeathsReportPublic,
  ImportsService,
  ReportsService,
} from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { NoPermission } from "@/components/Common/NoPermission"
import { Select } from "@/components/Common/Select"
import { StatCard } from "@/components/Common/StatCard"
import { roleStyles, statusStyles } from "@/components/Common/statusStyles"
import {
  TablePagination,
  usePagination,
} from "@/components/Common/TablePagination"
import { ExportFormatDialog } from "@/components/Reports/ExportFormatDialog"
import {
  ReportLetterhead,
  ReportSignatories,
} from "@/components/Reports/ReportLetterhead"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import i18n from "@/i18n"
import { isSystemAdministrator } from "@/lib/access"
import { documentTypeLabel } from "@/lib/issuanceLabels"
import {
  FIXED_LOCALE,
  formatLocaleDate,
  formatLocaleNumber,
} from "@/lib/locale"
import { notify } from "@/lib/notifications"
import { reportPageRule } from "@/lib/print/paperSizes"
import {
  buildReportFile,
  type ReportFormat,
  reportMime,
} from "@/lib/reports/reportFiles"
import { userFullName } from "@/lib/userNames"

export const Route = createFileRoute("/_layout/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: pageTitle("Management Reports") }] }),
})

type Period = "week" | "month" | "quarter" | "year"
type ReportType =
  | "issuances"
  | "purpose"
  | "expiry"
  | "imports"
  | "accounts"
  | "utilization"
  | "deaths"

type NoticeKey = "notLoaded" | "notRecorded"

function notice(key: NoticeKey) {
  notify({ key: `admin.reports.notices.${key}` }, "warning")
}

const periodKeys = {
  week: "admin.reports.periods.week",
  month: "admin.reports.periods.month",
  quarter: "admin.reports.periods.quarter",
  year: "admin.reports.periods.year",
} as const satisfies Record<Period, ParseKeys>

const kindKeys = {
  clearance: "admin.reports.kinds.clearance",
  barangay_id: "admin.reports.kinds.barangay_id",
} as const satisfies Record<string, ParseKeys>

const expiryStatusKeys = {
  expiring_soon: "admin.reports.expiryStatus.expiring_soon",
  expired: "admin.reports.expiryStatus.expired",
} as const satisfies Record<string, ParseKeys>

// The badge style is looked up by the English status word.
const expiryStatusStyleKey: Record<string, string> = {
  expiring_soon: "Expiring soon",
  expired: "Expired",
}

const importStatusKeys = {
  committed: "records.import.status.committed",
  failed: "records.import.status.failed",
  cancelled: "records.import.status.cancelled",
  expired: "records.import.status.expired",
  uploaded: "records.import.status.uploaded",
  mapped: "records.import.status.mapped",
} as const satisfies Record<string, ParseKeys>

// The badge style is looked up by the English status word.
const importStatusStyleKey: Record<string, string> = {
  committed: "Completed",
  failed: "Failed",
}

const roleKeys = {
  admin: "admin.reports.roles.admin",
  staff: "admin.reports.roles.staff",
} as const satisfies Record<string, ParseKeys>

// A value with no entry is shown exactly as the API returned it.
function labelOf(keys: Record<string, ParseKeys>, value: string, t: TFunction) {
  const key = keys[value]
  return key ? t(key) : value
}

// Business dates ("YYYY-MM-DD") are formatted without time zones.
function formatReportDate(value: string, locale?: string) {
  const [year, month, day] = value.split("-").map(Number)
  return formatLocaleDate(
    new Date(year, month - 1, day),
    {
      month: "short",
      day: "2-digit",
      year: "numeric",
    },
    locale,
  )
}

function formatMoment(value: string | null, locale?: string) {
  return value
    ? formatLocaleDate(
        new Date(value),
        {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Asia/Manila",
        },
        locale,
      )
    : "—"
}

function formatShare(value: number | null, locale?: string) {
  return value === null
    ? "—"
    : `${formatLocaleNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, locale)}%`
}

function formatChange(value: number | null, locale?: string) {
  if (value === null) return "—"
  return `${value > 0 ? "+" : ""}${formatLocaleNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, locale)}%`
}

function daysText(daysLeft: number, t: TFunction) {
  if (daysLeft === 0) return t("admin.reports.days.today")
  if (daysLeft > 0) return t("admin.reports.days.in", { count: daysLeft })
  return t("admin.reports.days.ago", { count: Math.abs(daysLeft) })
}

/** "November 2026" for a "YYYY-MM" key, in the interface language (the fixed locale in saved files). */
function utilizationMonth(key: string, locale?: string) {
  const [year, month] = key.split("-").map(Number)
  return formatLocaleDate(
    new Date(year, month - 1, 1),
    { month: "long", year: "numeric" },
    locale,
  )
}

/** The dates counted in a month row: "Nov 01, 2026 – Nov 26, 2026". */
function utilizationDates(
  row: { month_start: string; month_end: string },
  locale?: string,
) {
  return `${formatReportDate(row.month_start, locale)} – ${formatReportDate(row.month_end, locale)}`
}

type DeathRow = {
  key: string
  section: "total" | "evidence" | "sex" | "age" | "purok" | "date"
  label: string
  count: number
  strong?: boolean
}

/** The Deaths report as rows (counts only), shared by the table and every saved file. */
function deathRows(data: DeathsReportPublic, t: TFunction): DeathRow[] {
  const rows: DeathRow[] = [
    {
      key: "total",
      section: "total",
      label: t("admin.reports.deaths.rows.total"),
      count: data.total,
      strong: true,
    },
    {
      key: "verified",
      section: "evidence",
      label: t("admin.reports.deaths.rows.verified"),
      count: data.verified,
    },
    {
      key: "reported",
      section: "evidence",
      label: t("admin.reports.deaths.rows.reported"),
      count: data.reported,
    },
    {
      key: "male",
      section: "sex",
      label: t("admin.reports.deaths.rows.male"),
      count: data.by_sex.male,
    },
    {
      key: "female",
      section: "sex",
      label: t("admin.reports.deaths.rows.female"),
      count: data.by_sex.female,
    },
    {
      key: "sexNotRecorded",
      section: "sex",
      label: t("admin.reports.deaths.rows.notRecorded"),
      count: data.by_sex.not_recorded,
    },
  ]
  for (const bracket of data.by_age) {
    rows.push({
      key: `age-${bracket.bracket}`,
      section: "age",
      label:
        bracket.bracket === "unknown"
          ? t("admin.reports.deaths.rows.ageUnknown")
          : bracket.bracket,
      count: bracket.count,
    })
  }
  for (const purok of data.by_purok) {
    rows.push({
      key: `purok-${purok.purok}`,
      section: "purok",
      label: t("admin.reports.deaths.rows.purok", { number: purok.purok }),
      count: purok.count,
    })
  }
  rows.push(
    {
      key: "purokNotRecorded",
      section: "purok",
      label: t("admin.reports.deaths.rows.purokNotRecorded"),
      count: data.purok_not_recorded,
    },
    {
      key: "dateUnknown",
      section: "date",
      label: t("admin.reports.deaths.rows.dateUnknown"),
      count: data.date_unknown,
    },
    {
      key: "dateTooGeneral",
      section: "date",
      label: t("admin.reports.deaths.rows.dateTooGeneral"),
      count: data.date_too_general,
    },
  )
  return rows
}

function deathSection(id: DeathRow["section"], t: TFunction) {
  switch (id) {
    case "total":
      return t("admin.reports.deaths.sections.total")
    case "evidence":
      return t("admin.reports.deaths.sections.evidence")
    case "sex":
      return t("admin.reports.deaths.sections.sex")
    case "age":
      return t("admin.reports.deaths.sections.age")
    case "purok":
      return t("admin.reports.deaths.sections.purok")
    case "date":
      return t("admin.reports.deaths.sections.date")
  }
}

function Reports() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [period, setPeriod] = useState<Period>("month")
  const [report, setReport] = useState<ReportType>("issuances")
  // The preview always follows the two selects: it loads with the page and
  // again whenever either select changes, with no button to press.
  const applied = { report, period }
  // While true, every row of the report is on the page so a print is complete.
  const [printAll, setPrintAll] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

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

  // Clients served and documents issued, month by month, as in the monthly Certificate of Utilization.
  const utilizationQuery = useQuery({
    queryKey: ["reports-utilization", applied?.period],
    queryFn: async () =>
      (
        await ReportsService.utilizationReport({
          query: { period: applied?.period },
        })
      ).data,
    enabled: isAdmin && applied?.report === "utilization",
  })

  // Deaths are counts only: no name and no date of death leaves the server.
  const deathsQuery = useQuery({
    queryKey: ["reports-deaths", applied?.period],
    queryFn: async () =>
      (
        await ReportsService.deaths({
          query: { period: applied?.period },
        })
      ).data,
    enabled: isAdmin && applied?.report === "deaths",
  })

  // Import history is a list of the latest imports, so the period does not apply.
  const importsQuery = useQuery({
    queryKey: ["reports-imports"],
    queryFn: async () =>
      (await ImportsService.listImports({ query: { limit: 100 } })).data,
    enabled: isAdmin && applied?.report === "imports",
  })

  const typeRows = typeQuery.data?.data ?? []
  const purposeRows = purposeQuery.data?.data ?? []
  const expiringRows = expiryQuery.data?.data ?? []
  const accountRows = accountQuery.data?.data ?? []
  const importRows = importsQuery.data?.data ?? []
  const utilizationRows = utilizationQuery.data?.data ?? []

  const resetKey = `${applied?.report}|${applied?.period}`
  const typePagination = usePagination(typeRows, 10, resetKey)
  const purposePagination = usePagination(purposeRows, 10, resetKey)
  const expiringPagination = usePagination(expiringRows, 10, resetKey)
  const accountPagination = usePagination(accountRows, 10, resetKey)
  const importsPagination = usePagination(importRows, 10, resetKey)
  const utilizationPagination = usePagination(utilizationRows, 12, resetKey)

  // Prints the previewed report only: the app shell is hidden by index.css while
  // the body carries "report-printing", and a dark theme is printed as light.
  useEffect(() => {
    if (!printAll) return
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const finish = () => {
      document.body.classList.remove("report-printing")
      if (wasDark) root.classList.add("dark")
      setPrintAll(false)
    }
    // Page size and margins for this print only; removed again in the cleanup.
    const pageStyle = document.createElement("style")
    pageStyle.setAttribute("data-report-page", "")
    pageStyle.textContent = reportPageRule()
    document.head.appendChild(pageStyle)
    document.body.classList.add("report-printing")
    root.classList.remove("dark")
    window.addEventListener("afterprint", finish, { once: true })
    const timer = window.setTimeout(() => window.print(), 200)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("afterprint", finish)
      pageStyle.remove()
      document.body.classList.remove("report-printing")
      if (wasDark) root.classList.add("dark")
    }
  }, [printAll])

  if (!isAdmin) return <NoPermission />

  const appliedPeriodText = t(periodKeys[applied?.period ?? period])
  const printedDate = formatLocaleDate(new Date(), {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  })
  const printedAt = formatLocaleDate(new Date(), {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  })

  // Every saved file (CSV, Excel, Word, PDF) is always English (owner decision, Nov 8), whatever the
  // interface language is: headers, labels, dates and numbers all use these.
  function buildCsvRows(): (string | number)[][] | null {
    if (!applied) return null
    const tEn = i18n.getFixedT("en")
    if (applied.report === "issuances") {
      if (!typeQuery.data) return null
      return [
        [
          tEn("admin.reports.issuances.columns.type"),
          tEn("admin.reports.issuances.columns.issued"),
          tEn("admin.reports.issuances.columns.voided"),
          tEn("admin.reports.issuances.columns.share"),
          tEn("admin.reports.issuances.columns.change"),
        ],
        ...typeRows.map((row) => [
          documentTypeLabel(row.code, row.name, tEn),
          row.issued,
          row.voided,
          formatShare(row.share_percent, FIXED_LOCALE),
          formatChange(row.change_percent, FIXED_LOCALE),
        ]),
        [
          tEn("admin.reports.total"),
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
        [
          tEn("admin.reports.purpose.columns.purpose"),
          tEn("admin.reports.purpose.columns.issued"),
          tEn("admin.reports.purpose.columns.share"),
        ],
        ...purposeRows.map((row) => [
          row.purpose_id === null
            ? tEn("admin.reports.noPurpose")
            : row.purpose,
          row.issued,
          formatShare(row.share_percent, FIXED_LOCALE),
        ]),
        [tEn("admin.reports.total"), purposeQuery.data.total_issued, ""],
      ]
    }
    if (applied.report === "expiry") {
      if (!expiryQuery.data) return null
      return [
        [
          tEn("admin.reports.expiry.columns.resident"),
          tEn("admin.reports.expiry.columns.record"),
          tEn("admin.reports.expiry.columns.reference"),
          tEn("admin.reports.expiry.columns.expires"),
          tEn("admin.reports.expiry.columns.status"),
        ],
        ...expiringRows.map((row) => [
          row.resident_name,
          labelOf(kindKeys, row.kind, tEn),
          row.reference_no,
          formatReportDate(row.expires_on, FIXED_LOCALE),
          labelOf(expiryStatusKeys, row.status, tEn),
        ]),
        [
          tEn("admin.reports.total"),
          expiringRows.length,
          tEn("admin.reports.expiry.csvRecords"),
          "",
          "",
        ],
      ]
    }
    if (applied.report === "imports") {
      if (!importsQuery.data) return null
      return [
        [
          tEn("admin.reports.imports.columns.date"),
          tEn("admin.reports.imports.columns.file"),
          tEn("admin.reports.imports.columns.by"),
          tEn("admin.reports.imports.columns.status"),
          tEn("admin.reports.imports.columns.created"),
          tEn("admin.reports.imports.columns.updated"),
          tEn("admin.reports.imports.columns.skipped"),
          tEn("admin.reports.imports.columns.failed"),
        ],
        ...importRows.map((row) => [
          formatMoment(row.created_at, FIXED_LOCALE),
          row.file_name,
          row.created_by_email ?? "",
          labelOf(importStatusKeys, row.status, tEn),
          row.result?.created ?? "",
          row.result?.updated ?? "",
          row.result?.skipped ?? "",
          row.result?.failed ?? "",
        ]),
      ]
    }
    if (applied.report === "utilization") {
      if (!utilizationQuery.data) return null
      return [
        [
          tEn("admin.reports.utilization.columns.month"),
          tEn("admin.reports.utilization.columns.dates"),
          tEn("admin.reports.utilization.columns.clients"),
          tEn("admin.reports.utilization.columns.documents"),
        ],
        ...utilizationRows.map((row) => [
          utilizationMonth(row.month, FIXED_LOCALE),
          utilizationDates(row, FIXED_LOCALE),
          row.clients_served,
          row.documents_issued,
        ]),
        [
          tEn("admin.reports.total"),
          "",
          utilizationQuery.data.total_clients,
          utilizationQuery.data.total_documents,
        ],
      ]
    }
    if (applied.report === "deaths") {
      if (!deathsQuery.data) return null
      return [
        [
          tEn("admin.reports.deaths.columns.group"),
          tEn("admin.reports.deaths.columns.detail"),
          tEn("admin.reports.deaths.columns.count"),
        ],
        ...deathRows(deathsQuery.data, tEn).map((row) => [
          deathSection(row.section, tEn),
          row.label,
          row.count,
        ]),
      ]
    }
    if (applied.report === "accounts") {
      if (!accountQuery.data) return null
      return [
        [
          tEn("admin.reports.accounts.columns.user"),
          tEn("admin.reports.accounts.columns.role"),
          tEn("admin.reports.accounts.columns.issued"),
          tEn("admin.reports.accounts.columns.changed"),
          tEn("admin.reports.accounts.columns.last"),
        ],
        ...accountRows.map((row) => [
          row.full_name || row.email,
          labelOf(roleKeys, row.role, tEn),
          row.documents_issued,
          row.records_changed,
          formatMoment(row.last_activity, FIXED_LOCALE),
        ]),
        [
          tEn("admin.reports.total"),
          "",
          accountRows.reduce((total, row) => total + row.documents_issued, 0),
          accountRows.reduce((total, row) => total + row.records_changed, 0),
          "",
        ],
      ]
    }
    return null
  }

  // The Activity Log must know about every report that leaves the screen, so
  // an export or print that cannot be recorded does not start.
  async function recordExport(mode: ReportFormat | "print"): Promise<boolean> {
    if (!applied) return false
    try {
      await ReportsService.recordExport({
        body: { report: applied.report, period: applied.period, mode },
      })
      return true
    } catch {
      notice("notRecorded")
      return false
    }
  }

  // The Export button asks for the file type first; this saves it.
  function openExport() {
    if (!buildCsvRows()) {
      notice("notLoaded")
      return
    }
    setExportOpen(true)
  }

  async function exportReport(format: ReportFormat) {
    setExportOpen(false)
    const rows = buildCsvRows()
    if (!rows) {
      notice("notLoaded")
      return
    }
    if (!(await recordExport(format))) return
    const tEn = i18n.getFixedT("en")
    const blob = new Blob(
      [
        buildReportFile(format, {
          title: tEn(`admin.reports.reportTypes.${applied.report}`),
          subtitle: `${tEn(periodKeys[applied.period])} · ${formatLocaleDate(
            new Date(),
            {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "Asia/Manila",
            },
            FIXED_LOCALE,
          )}`,
          rows,
        }) as BlobPart,
      ],
      { type: reportMime[format] },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `management-report-${applied.report}-${applied.period}.${format}`
    link.click()
    URL.revokeObjectURL(url)
    notify(
      {
        key: "admin.reports.notices.exportStarted",
        values: {
          format: i18n.getFixedT("en")(
            `admin.reports.exportDialog.formats.${format}.name`,
          ),
        },
      },
      "success",
    )
  }

  async function printReport() {
    if (!buildCsvRows()) {
      notice("notLoaded")
      return
    }
    if (!(await recordExport("print"))) return
    setPrintAll(true)
  }

  const th = "px-4 py-3 font-medium sm:px-5"
  const td = "px-4 py-3 sm:px-5"
  // Long names, e-mails and file names break inside the word, so a report never needs a sideways scroll on a laptop.
  const wrap = "[overflow-wrap:anywhere]"
  // Import history has eight columns, so its cells use less side padding.
  const thTight = "px-3 py-3 font-medium"
  const tdTight = "px-3 py-3"
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
          <p className="mt-3 font-medium">
            {t("admin.reports.previewArea.title")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.reports.previewArea.description")}
          </p>
        </div>
      )
    }

    const loadFailed = (retry: () => void) => (
      <ErrorState
        title={t("admin.reports.loadFailed.title")}
        description={t("admin.reports.loadFailed.description")}
        onRetry={retry}
      />
    )

    if (applied.report === "issuances") {
      if (typeQuery.isLoading)
        return <LoadingState title={t("admin.reports.loading")} />
      if (typeQuery.isError || !typeQuery.data)
        return loadFailed(() => typeQuery.refetch())
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            {t("admin.reports.issuances.title", { period: appliedPeriodText })}
          </h3>
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {(["type", "issued", "voided", "share", "change"] as const).map(
                  (id) => (
                    <th key={id} className={th}>
                      {t(`admin.reports.issuances.columns.${id}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(printAll ? typeRows : typePagination.paginatedItems).map(
                (row) => (
                  <tr
                    key={row.document_type_id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className={`${td} font-medium`}>
                      {documentTypeLabel(row.code, row.name, t)}
                    </td>
                    <td className={`${td} tabular-nums`}>{row.issued}</td>
                    <td className={`${td} tabular-nums`}>{row.voided}</td>
                    <td className={td}>{formatShare(row.share_percent)}</td>
                    <td className={td}>{formatChange(row.change_percent)}</td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className={td}>{t("admin.reports.total")}</td>
                <td className={td}>{typeQuery.data.total_issued}</td>
                <td className={td}>{typeQuery.data.total_voided}</td>
                <td className={td}>—</td>
                <td className={td}>—</td>
              </tr>
            </tfoot>
          </table>
          {typeRows.length === 0 ? (
            <EmptyState
              title={t("admin.reports.issuances.empty.title")}
              description={t("admin.reports.issuances.empty.description")}
            />
          ) : null}
          <TablePagination
            start={typePagination.start}
            end={typePagination.end}
            total={typePagination.total}
            pageIndex={typePagination.pageIndex}
            pageCount={typePagination.pageCount}
            onPageChange={typePagination.setPageIndex}
            pageSize={typePagination.pageSize}
            onPageSizeChange={typePagination.setPageSize}
          />
        </div>
      )
    }

    if (applied.report === "purpose") {
      if (purposeQuery.isLoading)
        return <LoadingState title={t("admin.reports.loading")} />
      if (purposeQuery.isError || !purposeQuery.data)
        return loadFailed(() => purposeQuery.refetch())
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            {t("admin.reports.purpose.title", { period: appliedPeriodText })}
          </h3>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {(["purpose", "issued", "share"] as const).map((id) => (
                  <th key={id} className={th}>
                    {t(`admin.reports.purpose.columns.${id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(printAll ? purposeRows : purposePagination.paginatedItems).map(
                (row) => (
                  <tr
                    key={row.purpose_id ?? "none"}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className={`${td} font-medium`}>
                      {row.purpose_id === null
                        ? t("admin.reports.noPurpose")
                        : row.purpose}
                    </td>
                    <td className={`${td} tabular-nums`}>{row.issued}</td>
                    <td className={td}>{formatShare(row.share_percent)}</td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className={td}>{t("admin.reports.total")}</td>
                <td className={td}>{purposeQuery.data.total_issued}</td>
                <td className={td}>—</td>
              </tr>
            </tfoot>
          </table>
          {purposeRows.length === 0 ? (
            <EmptyState
              title={t("admin.reports.purpose.empty.title")}
              description={t("admin.reports.purpose.empty.description")}
            />
          ) : null}
          <TablePagination
            start={purposePagination.start}
            end={purposePagination.end}
            total={purposePagination.total}
            pageIndex={purposePagination.pageIndex}
            pageCount={purposePagination.pageCount}
            onPageChange={purposePagination.setPageIndex}
            pageSize={purposePagination.pageSize}
            onPageSizeChange={purposePagination.setPageSize}
          />
        </div>
      )
    }

    if (applied.report === "utilization") {
      if (utilizationQuery.isLoading)
        return <LoadingState title={t("admin.reports.loading")} />
      if (utilizationQuery.isError || !utilizationQuery.data)
        return loadFailed(() => utilizationQuery.refetch())
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            {t("admin.reports.utilization.title", {
              period: appliedPeriodText,
            })}
          </h3>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {(["month", "dates", "clients", "documents"] as const).map(
                  (id) => (
                    <th key={id} className={th}>
                      {t(`admin.reports.utilization.columns.${id}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(printAll
                ? utilizationRows
                : utilizationPagination.paginatedItems
              ).map((row) => (
                <tr
                  key={row.month}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className={`${td} font-medium`}>
                    {utilizationMonth(row.month)}
                  </td>
                  <td className={td}>{utilizationDates(row)}</td>
                  <td className={`${td} tabular-nums`}>{row.clients_served}</td>
                  <td className={`${td} tabular-nums`}>
                    {row.documents_issued}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className={td}>{t("admin.reports.total")}</td>
                <td className={td}>—</td>
                <td className={`${td} tabular-nums`}>
                  {utilizationQuery.data.total_clients}
                </td>
                <td className={`${td} tabular-nums`}>
                  {utilizationQuery.data.total_documents}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("admin.reports.utilization.totalNote")}
          </p>
          {utilizationQuery.data.total_documents === 0 ? (
            <EmptyState
              title={t("admin.reports.utilization.empty.title")}
              description={t("admin.reports.utilization.empty.description")}
            />
          ) : null}
          <TablePagination
            start={utilizationPagination.start}
            end={utilizationPagination.end}
            total={utilizationPagination.total}
            pageIndex={utilizationPagination.pageIndex}
            pageCount={utilizationPagination.pageCount}
            onPageChange={utilizationPagination.setPageIndex}
            pageSize={utilizationPagination.pageSize}
            onPageSizeChange={utilizationPagination.setPageSize}
          />
        </div>
      )
    }

    if (applied.report === "deaths") {
      if (deathsQuery.isLoading)
        return <LoadingState title={t("admin.reports.loading")} />
      if (deathsQuery.isError || !deathsQuery.data)
        return loadFailed(() => deathsQuery.refetch())
      const data = deathsQuery.data
      const rows = deathRows(data, t)
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            {t("admin.reports.deaths.title", { period: appliedPeriodText })}
          </h3>
          <table className="w-full text-left text-sm">
            <thead className={thead}>
              <tr>
                {(["group", "detail", "count"] as const).map((id) => (
                  <th key={id} className={thTight}>
                    {t(`admin.reports.deaths.columns.${id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  className={`transition-colors hover:bg-muted/30 ${row.strong ? "bg-muted/30 font-semibold" : ""}`}
                >
                  <td className={`${tdTight} align-top font-medium`}>
                    {index === 0 || rows[index - 1].section !== row.section
                      ? deathSection(row.section, t)
                      : ""}
                  </td>
                  <td className={`${tdTight} align-top`}>{row.label}</td>
                  <td
                    className={`${tdTight} align-top text-right tabular-nums`}
                  >
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("admin.reports.deaths.note")}
          </p>
          {data.total === 0 &&
          data.date_unknown === 0 &&
          data.date_too_general === 0 ? (
            <EmptyState
              title={t("admin.reports.deaths.empty.title")}
              description={t("admin.reports.deaths.empty.description")}
            />
          ) : null}
        </div>
      )
    }

    if (applied.report === "expiry") {
      if (expiryQuery.isLoading)
        return <LoadingState title={t("admin.reports.loading")} />
      if (expiryQuery.isError || !expiryQuery.data)
        return loadFailed(() => expiryQuery.refetch())
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            {t("admin.reports.expiry.title")}
          </h3>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {(
                  [
                    "resident",
                    "record",
                    "reference",
                    "expires",
                    "status",
                  ] as const
                ).map((id) => (
                  <th key={id} className={th}>
                    {t(`admin.reports.expiry.columns.${id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(printAll
                ? expiringRows
                : expiringPagination.paginatedItems
              ).map((row) => {
                const statusText = labelOf(expiryStatusKeys, row.status, t)
                return (
                  <tr
                    key={row.issuance_id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className={`${td} font-semibold ${wrap}`}>
                      {row.resident_name}
                    </td>
                    <td className={td}>{labelOf(kindKeys, row.kind, t)}</td>
                    <td className={`${td} font-mono ${wrap}`}>
                      {row.reference_no}
                    </td>
                    <td className={td}>
                      <p>{formatReportDate(row.expires_on)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {daysText(row.days_left, t)}
                      </p>
                    </td>
                    <td className={td}>
                      <Badge
                        variant="outline"
                        className={
                          statusStyles[
                            expiryStatusStyleKey[row.status] ?? row.status
                          ]
                        }
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
                  {t("admin.reports.expiry.total", {
                    total: expiryQuery.data.count,
                  })}
                  {expiryQuery.data.count > expiringRows.length
                    ? t("admin.reports.expiry.showing", {
                        shown: expiringRows.length,
                      })
                    : ""}
                </td>
              </tr>
            </tfoot>
          </table>
          {expiringRows.length === 0 ? (
            <EmptyState
              title={t("admin.reports.expiry.empty.title")}
              description={t("admin.reports.expiry.empty.description")}
            />
          ) : null}
          <TablePagination
            start={expiringPagination.start}
            end={expiringPagination.end}
            total={expiringPagination.total}
            pageIndex={expiringPagination.pageIndex}
            pageCount={expiringPagination.pageCount}
            onPageChange={expiringPagination.setPageIndex}
            pageSize={expiringPagination.pageSize}
            onPageSizeChange={expiringPagination.setPageSize}
          />
        </div>
      )
    }

    if (applied.report === "imports") {
      if (importsQuery.isLoading)
        return <LoadingState title={t("admin.reports.loading")} />
      if (importsQuery.isError || !importsQuery.data)
        return loadFailed(() => importsQuery.refetch())
      if (importRows.length === 0)
        return (
          <EmptyState
            title={t("admin.reports.imports.empty.title")}
            description={t("admin.reports.imports.empty.description")}
          />
        )
      return (
        <div className="overflow-x-auto">
          <h3 className="mb-3 font-semibold tracking-tight">
            {t("admin.reports.imports.title")}
          </h3>
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className={thead}>
              <tr>
                {(
                  [
                    "date",
                    "file",
                    "by",
                    "status",
                    "created",
                    "updated",
                    "skipped",
                    "failed",
                  ] as const
                ).map((id) => (
                  <th key={id} className={thTight}>
                    {t(`admin.reports.imports.columns.${id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(printAll ? importRows : importsPagination.paginatedItems).map(
                (row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className={tdTight}>{formatMoment(row.created_at)}</td>
                    <td className={`${tdTight} max-w-[16rem] ${wrap}`}>
                      {row.file_name}
                    </td>
                    <td className={`${tdTight} max-w-[14rem] ${wrap}`}>
                      {row.created_by_email ?? "—"}
                    </td>
                    <td className={tdTight}>
                      <Badge
                        variant="outline"
                        className={
                          statusStyles[
                            importStatusStyleKey[row.status] ?? "Pending"
                          ]
                        }
                      >
                        {labelOf(importStatusKeys, row.status, t)}
                      </Badge>
                    </td>
                    {(["created", "updated", "skipped", "failed"] as const).map(
                      (id) => (
                        <td key={id} className={`${tdTight} tabular-nums`}>
                          {row.result ? (row.result[id] ?? 0) : "—"}
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <TablePagination
            start={importsPagination.start}
            end={importsPagination.end}
            total={importsPagination.total}
            pageIndex={importsPagination.pageIndex}
            pageCount={importsPagination.pageCount}
            onPageChange={importsPagination.setPageIndex}
            pageSize={importsPagination.pageSize}
            onPageSizeChange={importsPagination.setPageSize}
          />
        </div>
      )
    }

    if (accountQuery.isLoading)
      return <LoadingState title={t("admin.reports.loading")} />
    if (accountQuery.isError || !accountQuery.data)
      return loadFailed(() => accountQuery.refetch())
    return (
      <div className="overflow-x-auto">
        <h3 className="mb-3 font-semibold tracking-tight">
          {t("admin.reports.accounts.title", { period: appliedPeriodText })}
        </h3>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={thead}>
            <tr>
              {(["user", "role", "issued", "changed", "last"] as const).map(
                (id) => (
                  <th key={id} className={th}>
                    {t(`admin.reports.accounts.columns.${id}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(printAll ? accountRows : accountPagination.paginatedItems).map(
              (row) => (
                <tr
                  key={row.user_id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className={`${td} max-w-[18rem] ${wrap}`}>
                    <p className="font-semibold">
                      {row.full_name || row.email}
                    </p>
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
                          ? roleStyles.admin
                          : roleStyles.staff
                      }
                    >
                      {labelOf(roleKeys, row.role, t)}
                    </Badge>
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {row.documents_issued}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {row.records_changed}
                  </td>
                  <td className={td}>{formatMoment(row.last_activity)}</td>
                </tr>
              ),
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-semibold">
              <td className={td} colSpan={2}>
                {t("admin.reports.total")}
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
            title={t("admin.reports.accounts.empty.title")}
            description={t("admin.reports.accounts.empty.description")}
          />
        ) : null}
        <TablePagination
          start={accountPagination.start}
          end={accountPagination.end}
          total={accountPagination.total}
          pageIndex={accountPagination.pageIndex}
          pageCount={accountPagination.pageCount}
          onPageChange={accountPagination.setPageIndex}
          pageSize={accountPagination.pageSize}
          onPageSizeChange={accountPagination.setPageSize}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <h1 className="page-title relative mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.reports.title")}
          </h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
        <StatCard
          icon={FileCheck2}
          label={t("admin.reports.stats.issued")}
          value={summaryQuery.data?.documents_issued ?? "—"}
          description={t(periodKeys[period])}
        />
        <StatCard
          icon={Clock3}
          label={t("admin.reports.stats.expiring")}
          value={summaryQuery.data?.records_expiring ?? "—"}
          description={t("admin.reports.stats.expiringDescription")}
        />
        <StatCard
          icon={FileUp}
          label={t("admin.reports.stats.imports")}
          value={summaryQuery.data?.imports_committed ?? "—"}
          description={t(periodKeys[period])}
        />
      </div>
      {summaryQuery.isError ? (
        <ErrorState
          title={t("admin.reports.summaryError")}
          onRetry={() => summaryQuery.refetch()}
        />
      ) : null}

      <section className="report-sheet overflow-hidden rounded-xl border bg-card shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-col gap-4 border-b p-4 sm:p-5 print:hidden">
          <div>
            <h2 className="font-semibold tracking-tight">
              {t("admin.reports.generate.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.reports.generate.description")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label
              htmlFor="report-type"
              className="flex min-w-0 flex-col gap-2 text-sm font-medium"
            >
              {t("admin.reports.generate.reportType")}
              <Select
                id="report-type"
                value={report}
                onChange={(event) => {
                  setReport(event.target.value as ReportType)
                }}
                className={`${formControlClass} min-w-52 font-normal`}
              >
                <option value="issuances">
                  {t("admin.reports.reportTypes.issuances")}
                </option>
                <option value="purpose">
                  {t("admin.reports.reportTypes.purpose")}
                </option>
                <option value="expiry">
                  {t("admin.reports.reportTypes.expiry")}
                </option>
                <option value="imports">
                  {t("admin.reports.reportTypes.imports")}
                </option>
                <option value="accounts">
                  {t("admin.reports.reportTypes.accounts")}
                </option>
                <option value="utilization">
                  {t("admin.reports.reportTypes.utilization")}
                </option>
                <option value="deaths">
                  {t("admin.reports.reportTypes.deaths")}
                </option>
              </Select>
            </label>
            <label
              htmlFor="report-period"
              className="flex min-w-0 flex-col gap-2 text-sm font-medium"
            >
              {t("admin.reports.generate.period")}
              <Select
                id="report-period"
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as Period)
                }}
                className={`${formControlClass} min-w-40 font-normal`}
              >
                <option value="week">{t(periodKeys.week)}</option>
                <option value="month">{t(periodKeys.month)}</option>
                <option value="quarter">{t(periodKeys.quarter)}</option>
                <option value="year">{t(periodKeys.year)}</option>
              </Select>
            </label>
            <Button variant="tintGreen" onClick={openExport}>
              <Download aria-hidden="true" />
              {t("admin.reports.generate.export")}
            </Button>
            <Button variant="tintViolet" onClick={printReport}>
              <Printer aria-hidden="true" />
              {t("admin.reports.generate.print")}
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-5 print:p-0">
          {applied ? (
            <ReportLetterhead
              title={t(
                `admin.reports.reportTypes.${applied.report}`,
              ).toUpperCase()}
              subtitle={t("admin.reports.title")}
              coverage={
                applied.report === "expiry" || applied.report === "imports"
                  ? t("admin.reports.print.asOf", { date: printedDate })
                  : t("admin.reports.print.period", {
                      period: appliedPeriodText,
                    })
              }
              printedOn={t("admin.reports.printedOn", { date: printedAt })}
            />
          ) : null}
          {renderResults()}
          {applied ? (
            <ReportSignatories
              preparedByLabel={t("admin.reports.print.preparedBy")}
              preparedByName={userFullName(user)}
              notedByLabel={t("admin.reports.print.notedBy")}
              notedByTitle={t("admin.reports.print.punongBarangay")}
            />
          ) : null}
        </div>
      </section>
      <ExportFormatDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onChoose={(format) => void exportReport(format)}
      />
    </div>
  )
}
