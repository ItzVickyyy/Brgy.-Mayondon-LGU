import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ParseKeys, TFunction } from "i18next"
import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ActivityService } from "@/client"
import { DateRangeField } from "@/components/Common/DateRangeField"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { Select } from "@/components/Common/Select"
import {
  PageCheckbox,
  RowCheckbox,
  SelectionBar,
  selectCol,
} from "@/components/Common/SelectionControls"
import { SortLabel } from "@/components/Common/SortLabel"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { activityTitle } from "@/lib/activity"
import { formatLocaleDate } from "@/lib/locale"
import { useRowSelection } from "@/lib/useRowSelection"
import { useSort } from "@/lib/useSort"

export const Route = createFileRoute("/_layout/activity-log")({
  component: ActivityLog,
  head: () => ({ meta: [{ title: pageTitle("Activity Log") }] }),
})

const filterLabelClass =
  "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground"

// Outcomes the API reports; the label comes from the language files.
const outcomes = ["success", "failed", "denied"] as const
type Outcome = (typeof outcomes)[number]

// statusStyles is keyed by the English status word, not by the shown label.
const outcomeStyleKey: Record<Outcome, string> = {
  success: "Success",
  failed: "Failed",
  denied: "Denied",
}

const detailKeyLabels = {
  fields: "activity.detailKeys.fields",
  field: "activity.detailKeys.field",
  file_name: "activity.detailKeys.file_name",
  rows: "activity.detailKeys.rows",
  role: "activity.detailKeys.role",
  reason: "activity.detailKeys.reason",
  scope: "activity.detailKeys.scope",
  duplicate_of: "activity.detailKeys.duplicate_of",
  original_status: "activity.detailKeys.original_status",
  archive_reason: "activity.detailKeys.archive_reason",
  verified_on: "activity.detailKeys.verified_on",
  previous_verified_on: "activity.detailKeys.previous_verified_on",
  created: "activity.detailKeys.created",
  updated: "activity.detailKeys.updated",
  skipped: "activity.detailKeys.skipped",
  failed: "activity.detailKeys.failed",
  duplicate: "activity.detailKeys.duplicate",
  error: "activity.detailKeys.error",
  new: "activity.detailKeys.new",
  kind: "activity.detailKeys.kind",
  size_bytes: "activity.detailKeys.size_bytes",
  replaced_temporary: "activity.detailKeys.replaced_temporary",
  corrects: "activity.detailKeys.corrects",
  document_type: "activity.detailKeys.document_type",
  id_transaction: "activity.detailKeys.id_transaction",
  purpose_added: "activity.detailKeys.purpose_added",
  reference_no: "activity.detailKeys.reference_no",
  draft_id: "activity.detailKeys.draft_id",
  replaced_by: "activity.detailKeys.replaced_by",
  automatic: "activity.detailKeys.automatic",
  mode: "activity.detailKeys.mode",
  numbering: "activity.detailKeys.numbering",
  next_number: "activity.detailKeys.next_number",
  id_number_source: "activity.detailKeys.id_number_source",
  question_ids: "activity.detailKeys.question_ids",
  method: "activity.detailKeys.method",
  copy: "activity.detailKeys.copy",
  status: "activity.detailKeys.status",
  count: "activity.detailKeys.count",
  report: "activity.detailKeys.report",
  period: "activity.detailKeys.period",
  keep_days: "activity.detailKeys.keep_days",
  password_emailed: "activity.detailKeys.password_emailed",
} as const satisfies Record<string, ParseKeys>

const moduleKeys = {
  records: "activity.modules.records",
  issuance: "activity.modules.issuance",
  users: "activity.modules.users",
  officials: "activity.modules.officials",
  lookups: "activity.modules.lookups",
  auth: "activity.modules.auth",
  reports: "activity.modules.reports",
  audit: "activity.modules.audit",
} as const satisfies Record<string, ParseKeys>

type ActivityColumn =
  | "dateTime"
  | "user"
  | "action"
  | "module"
  | "record"
  | "outcome"

function isOutcome(value: string): value is Outcome {
  return (outcomes as readonly string[]).includes(value)
}

function moduleLabel(value: string | null, t: TFunction) {
  if (!value) return "—"
  const key = (moduleKeys as Record<string, ParseKeys>)[value]
  if (key) return t(key)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatTimestamp(value: string) {
  return formatLocaleDate(new Date(value), {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  })
}

// Details only hold field names, ids and reference numbers. Shown as plain text.
function detailLabel(key: string, t: TFunction) {
  const labelKey = (detailKeyLabels as Record<string, ParseKeys>)[key]
  return labelKey ? t(labelKey) : key.replace(/_/g, " ")
}

// Details that only matter to the program (ids, flags already said in the title).
const hiddenDetailKeys = new Set(["automatic", "draft_id", "corrects"])

function capitalise(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}

function detailValue(value: unknown, t: TFunction) {
  if (typeof value === "boolean") {
    return t(value ? "activity.yes" : "activity.no")
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).replace(/_/g, " ")).join(", ")
  }
  return String(value)
}

// One labelled line per detail ("Reference no.: IC-2026-001"), so a row reads
// as a short list and not as one long sentence.
function detailLines(
  details: { [key: string]: unknown } | null,
  reason: string | null,
  t: TFunction,
) {
  const lines: { label: string; value: string }[] = []
  if (reason) {
    // A document replaced by an edit stores "Replaced by correction X. Reason: Y";
    // the reference is already listed below, so show only Y.
    const why = reason.replace(/^Replaced by correction [^.]*\. Reason: /, "")
    lines.push({ label: t("activity.reasonLabel"), value: why })
  }
  for (const [key, value] of Object.entries(details ?? {})) {
    if (hiddenDetailKeys.has(key)) continue
    if (key === "reason" && value === reason) continue
    if (value === null || value === undefined || value === "") continue
    if (Array.isArray(value) && value.length === 0) continue
    lines.push({
      label: capitalise(detailLabel(key, t)),
      value: detailValue(value, t),
    })
  }
  return lines
}

function shortId(value: string) {
  return value.length > 13 ? `${value.slice(0, 8)}…` : value
}

function ActivityLog() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [outcomeFilter, setOutcomeFilter] = useState("all")
  const [actorFilter, setActorFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    )
    return () => window.clearTimeout(timer)
  }, [search])

  // Any filter change returns to the first page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the filters are the trigger.
  useEffect(() => {
    setPageIndex(0)
  }, [
    debouncedSearch,
    moduleFilter,
    outcomeFilter,
    actorFilter,
    startDate,
    endDate,
  ])

  const rangeInvalid = Boolean(startDate && endDate && startDate > endDate)
  const hasFilters =
    search.trim() !== "" ||
    moduleFilter !== "all" ||
    outcomeFilter !== "all" ||
    actorFilter !== "all" ||
    startDate !== "" ||
    endDate !== ""
  const resetFilters = () => {
    setSearch("")
    setModuleFilter("all")
    setOutcomeFilter("all")
    setActorFilter("all")
    setStartDate("")
    setEndDate("")
  }

  const optionsQuery = useQuery({
    queryKey: ["activity-options"],
    queryFn: async () => (await ActivityService.activityOptions()).data,
  })

  const activityQuery = useQuery({
    queryKey: [
      "activity",
      debouncedSearch,
      moduleFilter,
      outcomeFilter,
      actorFilter,
      startDate,
      endDate,
      pageIndex,
      pageSize,
    ],
    queryFn: async () =>
      (
        await ActivityService.listActivity({
          query: {
            q: debouncedSearch || undefined,
            module: moduleFilter === "all" ? undefined : moduleFilter,
            outcome:
              outcomeFilter === "all"
                ? undefined
                : (outcomeFilter as "success" | "failed" | "denied"),
            actor_user_id:
              isAdmin && actorFilter !== "all" ? actorFilter : undefined,
            date_from: startDate || undefined,
            date_to: endDate || undefined,
            skip: pageIndex * pageSize,
            limit: pageSize,
          },
        })
      ).data,
    enabled: !rangeInvalid,
    placeholderData: keepPreviousData,
  })

  const items = activityQuery.data?.data ?? []
  const total = activityQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? pageIndex * pageSize + 1 : 0
  const end = Math.min((pageIndex + 1) * pageSize, total)
  const columns: ActivityColumn[] = [
    "dateTime",
    ...(isAdmin ? (["user"] as const) : []),
    "action",
    "module",
    "record",
    "outcome",
  ]
  // Server pages: a selection lasts only while its rows are on screen.
  const pickRows = useRowSelection(items, (row) => String(row.id))
  // Click a heading to sort the rows on this page (292).
  const sort = useSort(items, {
    dateTime: (row) => row.occurred_at,
    user: (row) => row.actor_email,
    action: (row) => activityTitle(row.action, t, row.details),
    module: (row) => row.module,
    record: (row) => row.record_id,
    outcome: (row) => row.outcome,
  })
  const modules = optionsQuery.data?.modules ?? []
  const actors = optionsQuery.data?.actors ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title relative mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("activity.title")}
          </h1>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">
              {t("activity.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("activity.sectionDescription")}
            </p>
          </div>
          <div className="flex flex-col gap-3 min-[1400px]:flex-row min-[1400px]:items-end">
            <div
              className={`grid min-w-0 gap-3 min-[1400px]:flex-1 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-[2fr_repeat(3,minmax(0,1fr))_17.5rem]" : "xl:grid-cols-[2fr_repeat(2,minmax(0,1fr))_17.5rem]"}`}
            >
              <label
                className={`${filterLabelClass} sm:col-span-2 xl:col-span-1`}
              >
                <span>{t("activity.filters.search")}</span>
                <span className="relative block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("activity.filters.searchPlaceholder")}
                    className={`${formControlClass} pl-9`}
                  />
                </span>
              </label>
              <label
                htmlFor="activity-module-filter"
                className={filterLabelClass}
              >
                <span>{t("activity.filters.module")}</span>
                <Select
                  id="activity-module-filter"
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  className={formControlClass}
                >
                  <option value="all">
                    {t("activity.filters.allModules")}
                  </option>
                  {modules.map((value) => (
                    <option key={value} value={value}>
                      {moduleLabel(value, t)}
                    </option>
                  ))}
                </Select>
              </label>
              <label
                htmlFor="activity-outcome-filter"
                className={filterLabelClass}
              >
                <span>{t("activity.filters.outcome")}</span>
                <Select
                  id="activity-outcome-filter"
                  value={outcomeFilter}
                  onChange={(event) => setOutcomeFilter(event.target.value)}
                  className={formControlClass}
                >
                  <option value="all">
                    {t("activity.filters.allOutcomes")}
                  </option>
                  {outcomes.map((value) => (
                    <option key={value} value={value}>
                      {t(`activity.outcomes.${value}`)}
                    </option>
                  ))}
                </Select>
              </label>
              {isAdmin ? (
                <label
                  htmlFor="activity-user-filter"
                  className={filterLabelClass}
                >
                  <span>{t("activity.filters.user")}</span>
                  <Select
                    id="activity-user-filter"
                    value={actorFilter}
                    onChange={(event) => setActorFilter(event.target.value)}
                    className={formControlClass}
                  >
                    <option value="all">
                      {t("activity.filters.allUsers")}
                    </option>
                    {actors.map((actor) => (
                      <option key={actor.id} value={actor.id}>
                        {actor.email}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
              <DateRangeField
                className="sm:col-span-2 xl:col-span-1"
                label={t("activity.filters.dateRange")}
                fromLabel={t("activity.filters.startDateAria")}
                toLabel={t("activity.filters.endDateAria")}
                from={startDate}
                to={endDate}
                onFromChange={setStartDate}
                onToChange={setEndDate}
              />
            </div>
            <SelectionBar
              inline
              count={pickRows.count}
              onClear={pickRows.clear}
              csvName="activity-selected.csv"
              csvRows={() => [
                columns.map((item) => t(`activity.columns.${item}`)),
                ...pickRows
                  .pick(items)
                  .map((row) => [
                    formatTimestamp(row.occurred_at),
                    ...(isAdmin ? [row.actor_email ?? "—"] : []),
                    activityTitle(row.action, t, row.details),
                    moduleLabel(row.module, t),
                    row.record_id ?? "—",
                    isOutcome(row.outcome)
                      ? t(`activity.outcomes.${row.outcome as Outcome}`)
                      : row.outcome,
                  ]),
              ]}
            />
          </div>
        </div>

        {rangeInvalid ? (
          <EmptyState
            title={t("activity.checkDates.title")}
            description={t("activity.checkDates.description")}
          />
        ) : activityQuery.isLoading ? (
          <LoadingState title={t("activity.loading")} />
        ) : activityQuery.isError ? (
          <ErrorState
            title={t("activity.loadError.title")}
            description={t("activity.loadError.description")}
            onRetry={() => activityQuery.refetch()}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={selectCol}>
                      <PageCheckbox
                        all={pickRows.allOnPage}
                        some={pickRows.someOnPage}
                        onChange={pickRows.togglePage}
                      />
                    </th>
                    {columns.map((item) => (
                      <th
                        key={item}
                        aria-sort={sort.ariaSort(item)}
                        className={`px-4 py-3 align-middle font-medium sm:px-5 ${item === "outcome" ? "sticky right-0 bg-muted sticky-head-cell" : ""}`}
                      >
                        <SortLabel
                          sort={sort}
                          column={item}
                          label={t(`activity.columns.${item}`)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sort.sorted.map((row) => {
                    const known = isOutcome(row.outcome)
                    const lines = detailLines(row.details, row.reason, t)
                    return (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className={selectCol}>
                          <RowCheckbox
                            label={activityTitle(row.action, t, row.details)}
                            checked={pickRows.isSelected(String(row.id))}
                            onChange={() => pickRows.toggle(String(row.id))}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          {formatTimestamp(row.occurred_at)}
                        </td>
                        {isAdmin ? (
                          <td className="px-4 py-3 align-middle font-medium sm:px-5">
                            {row.is_own
                              ? t("activity.youWithName", {
                                  name: row.actor_email ?? t("activity.you"),
                                })
                              : (row.actor_email ?? "—")}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <p className="font-medium">
                            {activityTitle(row.action, t, row.details)}
                          </p>
                          {lines.length ? (
                            <dl className="mt-1.5 flex max-w-sm flex-col gap-0.5 text-xs">
                              {lines.map((line) => (
                                <div
                                  key={`${line.label}-${line.value}`}
                                  className="flex flex-wrap gap-x-1.5"
                                >
                                  <dt className="text-muted-foreground">
                                    {line.label}:
                                  </dt>
                                  <dd className="min-w-0 break-words">
                                    {line.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">
                          {moduleLabel(row.module, t)}
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          {row.record_id ? (
                            <span className="font-mono" title={row.record_id}>
                              {shortId(row.record_id)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="sticky right-0 bg-card row-hover-cell px-4 py-3 align-middle sm:px-5 sticky-edge">
                          <Badge
                            variant="outline"
                            className={
                              known
                                ? statusStyles[
                                    outcomeStyleKey[row.outcome as Outcome]
                                  ]
                                : undefined
                            }
                          >
                            {known
                              ? t(`activity.outcomes.${row.outcome as Outcome}`)
                              : row.outcome}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {items.length === 0 ? (
                <EmptyState
                  title={t("activity.empty.title")}
                  description={t("activity.empty.description")}
                  action={
                    hasFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={resetFilters}
                      >
                        <X aria-hidden="true" />
                        {t("issuances.history.resetFilters")}
                      </Button>
                    ) : undefined
                  }
                />
              ) : null}
            </div>
            <TablePagination
              start={start}
              end={end}
              total={total}
              pageIndex={pageIndex}
              pageCount={pageCount}
              onPageChange={setPageIndex}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPageIndex(0)
              }}
            />
          </>
        )}
      </section>
    </div>
  )
}
