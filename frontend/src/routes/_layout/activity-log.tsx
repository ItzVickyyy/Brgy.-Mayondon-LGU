import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ParseKeys, TFunction } from "i18next"
import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ActivityService } from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { activityTitle } from "@/lib/activity"
import { formatLocaleDate } from "@/lib/locale"

export const Route = createFileRoute("/_layout/activity-log")({
  component: ActivityLog,
  head: () => ({ meta: [{ title: pageTitle("Activity Log") }] }),
})

const PAGE_SIZE = 10

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

const moduleKeys = {
  records: "activity.modules.records",
  issuance: "activity.modules.issuance",
  users: "activity.modules.users",
  officials: "activity.modules.officials",
  lookups: "activity.modules.lookups",
  auth: "activity.modules.auth",
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
function detailsText(details: { [key: string]: unknown } | null) {
  if (!details) return ""
  return Object.entries(details)
    .map(([key, value]) => {
      const text = Array.isArray(value) ? value.join(", ") : String(value)
      return `${key.replace(/_/g, " ")}: ${text}`
    })
    .join(" · ")
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
            skip: pageIndex * PAGE_SIZE,
            limit: PAGE_SIZE,
          },
        })
      ).data,
    enabled: !rangeInvalid,
    placeholderData: keepPreviousData,
  })

  const items = activityQuery.data?.data ?? []
  const total = activityQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total ? pageIndex * PAGE_SIZE + 1 : 0
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, total)
  const columns: ActivityColumn[] = [
    "dateTime",
    ...(isAdmin ? (["user"] as const) : []),
    "action",
    "module",
    "record",
    "outcome",
  ]
  const modules = optionsQuery.data?.modules ?? []
  const actors = optionsQuery.data?.actors ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("activity.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin
              ? t("activity.subtitleAdmin")
              : t("activity.subtitleStaff")}
          </p>
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
          <div
            className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-[2fr_repeat(5,minmax(0,1fr))]" : "xl:grid-cols-[2fr_repeat(4,minmax(0,1fr))]"}`}
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
            <label className={filterLabelClass}>
              <span>{t("activity.filters.module")}</span>
              <select
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className={formControlClass}
              >
                <option value="all">{t("activity.filters.allModules")}</option>
                {modules.map((value) => (
                  <option key={value} value={value}>
                    {moduleLabel(value, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              <span>{t("activity.filters.outcome")}</span>
              <select
                value={outcomeFilter}
                onChange={(event) => setOutcomeFilter(event.target.value)}
                className={formControlClass}
              >
                <option value="all">{t("activity.filters.allOutcomes")}</option>
                {outcomes.map((value) => (
                  <option key={value} value={value}>
                    {t(`activity.outcomes.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            {isAdmin ? (
              <label className={filterLabelClass}>
                <span>{t("activity.filters.user")}</span>
                <select
                  value={actorFilter}
                  onChange={(event) => setActorFilter(event.target.value)}
                  className={formControlClass}
                >
                  <option value="all">{t("activity.filters.allUsers")}</option>
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={filterLabelClass}>
              <span>{t("activity.filters.from")}</span>
              <input
                aria-label={t("activity.filters.startDateAria")}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={formControlClass}
              />
            </label>
            <label className={filterLabelClass}>
              <span>{t("activity.filters.to")}</span>
              <input
                aria-label={t("activity.filters.endDateAria")}
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className={formControlClass}
              />
            </label>
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
                    {columns.map((item) => (
                      <th
                        key={item}
                        className="px-4 py-3 align-middle font-medium sm:px-5"
                      >
                        {t(`activity.columns.${item}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((row) => {
                    const known = isOutcome(row.outcome)
                    const details = detailsText(row.details)
                    return (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          {formatTimestamp(row.occurred_at)}
                        </td>
                        {isAdmin ? (
                          <td className="px-4 py-3 align-middle font-medium sm:px-5">
                            {row.is_own
                              ? t("activity.you")
                              : (row.actor_email ?? "—")}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <p className="font-medium">
                            {activityTitle(row.action, t)}
                          </p>
                          {row.reason ? (
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              {row.reason}
                            </p>
                          ) : null}
                          {details ? (
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              {details}
                            </p>
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
                        <td className="px-4 py-3 align-middle sm:px-5">
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
            />
          </>
        )}
      </section>
    </div>
  )
}
