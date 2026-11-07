import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useEffect, useState } from "react"

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
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { activityTitle } from "@/lib/activity"

export const Route = createFileRoute("/_layout/activity-log")({
  component: ActivityLog,
  head: () => ({ meta: [{ title: pageTitle("Activity Log") }] }),
})

const PAGE_SIZE = 10

const filterLabelClass =
  "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground"

const moduleLabels: Record<string, string> = {
  records: "Resident Records",
  issuance: "Issuances",
  users: "User Accounts",
  officials: "Officials",
  lookups: "Streets and Associations",
  auth: "Sign-ins",
}

const outcomeLabels: Record<string, string> = {
  success: "Success",
  failed: "Failed",
  denied: "Denied",
}

function moduleLabel(value: string | null) {
  if (!value) return "—"
  if (moduleLabels[value]) return moduleLabels[value]
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const timestampFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
})

function formatTimestamp(value: string) {
  return timestampFormat.format(new Date(value))
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
  const modules = optionsQuery.data?.modules ?? []
  const actors = optionsQuery.data?.actors ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Activity Log
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin
              ? "Review activity across user accounts."
              : "Review activity associated with your account."}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">Activity Log</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review who did what, when, and whether the action succeeded.
            </p>
          </div>
          <div
            className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-[2fr_repeat(5,minmax(0,1fr))]" : "xl:grid-cols-[2fr_repeat(4,minmax(0,1fr))]"}`}
          >
            <label
              className={`${filterLabelClass} sm:col-span-2 xl:col-span-1`}
            >
              <span>Search</span>
              <span className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search action, record, or module"
                  className={`${formControlClass} pl-9`}
                />
              </span>
            </label>
            <label className={filterLabelClass}>
              <span>Module</span>
              <select
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className={formControlClass}
              >
                <option value="all">All modules</option>
                {modules.map((value) => (
                  <option key={value} value={value}>
                    {moduleLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              <span>Outcome</span>
              <select
                value={outcomeFilter}
                onChange={(event) => setOutcomeFilter(event.target.value)}
                className={formControlClass}
              >
                <option value="all">All outcomes</option>
                {Object.entries(outcomeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {isAdmin ? (
              <label className={filterLabelClass}>
                <span>User</span>
                <select
                  value={actorFilter}
                  onChange={(event) => setActorFilter(event.target.value)}
                  className={formControlClass}
                >
                  <option value="all">All users</option>
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={filterLabelClass}>
              <span>From</span>
              <input
                aria-label="Start date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={formControlClass}
              />
            </label>
            <label className={filterLabelClass}>
              <span>To</span>
              <input
                aria-label="End date"
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
            title="Check the dates"
            description="The start date is after the end date."
          />
        ) : activityQuery.isLoading ? (
          <LoadingState title="Loading activity..." />
        ) : activityQuery.isError ? (
          <ErrorState
            title="Could not load the activity log"
            description="Check your connection and try again."
            onRetry={() => activityQuery.refetch()}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      "Date & time",
                      ...(isAdmin ? ["User"] : []),
                      "Action",
                      "Module",
                      "Record",
                      "Outcome",
                    ].map((item) => (
                      <th
                        key={item}
                        className="px-4 py-3 align-middle font-medium sm:px-5"
                      >
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((row) => {
                    const outcome = outcomeLabels[row.outcome] ?? row.outcome
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
                            {row.is_own ? "You" : (row.actor_email ?? "—")}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <p className="font-medium">
                            {activityTitle(row.action)}
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
                          {moduleLabel(row.module)}
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
                            className={statusStyles[outcome]}
                          >
                            {outcome}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {items.length === 0 ? (
                <EmptyState
                  title="No matching activity"
                  description="Try a different search term or filter."
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
