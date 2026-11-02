import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { EmptyState } from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/activity-log")({
  component: ActivityLog,
  head: () => ({ meta: [{ title: pageTitle("Activity Log") }] }),
})

type ActivityOutcome = "Success" | "Failed" | "Denied"

type ActivityRow = {
  timestamp: string
  user: string
  owner: "current" | "other"
  action: string
  reason?: string
  module: string
  recordReference?: string
  recordHref?: string
  outcome: ActivityOutcome
}

const rows: ActivityRow[] = [
  {
    timestamp: "2026-10-28T10:42:00",
    user: "admin",
    owner: "other",
    action: "Updated resident details",
    reason: "Corrected address after resident verification",
    module: "Resident Records",
    recordReference: "RES-0001",
    recordHref: "/records",
    outcome: "Success",
  },
  {
    timestamp: "2026-10-28T09:55:00",
    user: "staff",
    owner: "current",
    action: "Prepared document request",
    module: "Issuances",
    recordReference: "ISS-0004",
    recordHref: "/issuances",
    outcome: "Success",
  },
  {
    timestamp: "2026-10-28T08:04:00",
    user: "staff",
    owner: "current",
    action: "Signed in to the system",
    module: "Authentication",
    outcome: "Success",
  },
  {
    timestamp: "2026-10-27T16:10:00",
    user: "admin",
    owner: "other",
    action: "Changed user account status",
    module: "User Accounts",
    recordReference: "USR-0002",
    recordHref: "/admin",
    outcome: "Success",
  },
  {
    timestamp: "2026-10-27T15:32:00",
    user: "staff",
    owner: "current",
    action: "Imported masterlist",
    module: "Resident Records",
    recordReference: "IMP-2026-10-27",
    recordHref: "/records",
    outcome: "Failed",
    reason: "Some rows could not be imported",
  },
  {
    timestamp: "2026-10-27T14:20:00",
    user: "staff",
    owner: "other",
    action: "Access attempt denied",
    module: "Authentication",
    outcome: "Denied",
    reason: "Account did not have permission for the requested action",
  },
]

function formatTimestamp(value: string) {
  const date = new Date(value)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).replace(",", " ·")
}

function getInitialActivityDateRange() {
  if (typeof window === "undefined") return { startDate: "", endDate: "" }
  const params = new URLSearchParams(window.location.search)
  const period = params.get("period")
  if (!period) return { startDate: "", endDate: "" }
  const today = new Date()
  const start = new Date(today)
  if (period === "week") start.setDate(today.getDate() - 6)
  else if (period === "month") start.setDate(1)
  else if (period === "quarter") start.setMonth(Math.floor(today.getMonth() / 3) * 3, 1)
  else if (period === "year") start.setMonth(0, 1)
  const toInputDate = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  return { startDate: toInputDate(start), endDate: toInputDate(today) }
}

function ActivityLog() {
  const { user } = useAuth()
  const isAdmin = Boolean(user?.is_superuser)
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [outcomeFilter, setOutcomeFilter] = useState("all")
  const [userFilter, setUserFilter] = useState(() => {
    if (typeof window === "undefined") return "all"
    return new URLSearchParams(window.location.search).get("user") ?? "all"
  })
  const [startDate, setStartDate] = useState(() => getInitialActivityDateRange().startDate)
  const [endDate, setEndDate] = useState(() => getInitialActivityDateRange().endDate)

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows
      .filter((row) => {
        const rowDate = row.timestamp.slice(0, 10)
        const matchesSearch = [
          row.user,
          row.action,
          row.reason ?? "",
          row.module,
          row.recordReference ?? "",
          row.outcome,
        ].some((value) => value.toLowerCase().includes(query))
        return (
          (isAdmin || row.owner === "current") &&
          matchesSearch &&
          (moduleFilter === "all" || row.module === moduleFilter) &&
          (outcomeFilter === "all" || row.outcome === outcomeFilter) &&
          (!isAdmin || userFilter === "all" || row.user === userFilter) &&
          (!startDate || rowDate >= startDate) &&
          (!endDate || rowDate <= endDate)
        )
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }, [endDate, isAdmin, moduleFilter, outcomeFilter, search, startDate, userFilter])

  const totalRows = rows.filter((row) => isAdmin || row.owner === "current").length

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
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search activity</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search action, record, or module"
                className={`${formControlClass} pl-9`}
              />
            </label>
            <label className="sm:w-52">
              <span className="sr-only">Filter by module</span>
              <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className={formControlClass}>
                <option value="all">All modules</option>
                <option>Resident Records</option>
                <option>Issuances</option>
                <option>Barangay IDs</option>
                <option>User Accounts</option>
                <option>Backup</option>
                <option>Authentication</option>
              </select>
            </label>
            <label className="sm:w-44">
              <span className="sr-only">Filter by outcome</span>
              <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)} className={formControlClass}>
                <option value="all">All outcomes</option>
                <option>Success</option>
                <option>Failed</option>
                <option>Denied</option>
              </select>
            </label>
            {isAdmin ? (
              <label className="sm:w-44">
                <span className="sr-only">Filter by user</span>
                <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className={formControlClass}>
                  <option value="all">All users</option>
                  {[...new Set(rows.map((row) => row.user))].sort().map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
            ) : null}
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-44">
              <span>From</span>
              <input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={formControlClass} />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-44">
              <span>To</span>
              <input aria-label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={formControlClass} />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Date & time", ...(isAdmin ? ["User"] : []), "Action", "Module", "Record", "Outcome"].map((item) => (
                  <th key={item} className="px-4 py-3 font-medium align-middle sm:px-5">{item}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.map((row) => (
                <tr key={row.timestamp + row.action} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">{formatTimestamp(row.timestamp)}</td>
                  {isAdmin ? <td className="px-4 py-3 align-middle font-medium sm:px-5">{row.user}</td> : null}
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <p className="font-medium">{row.action}</p>
                    {row.reason ? <p className="mt-1 max-w-xs text-xs text-muted-foreground">{row.reason}</p> : null}
                  </td>
                  <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">{row.module}</td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    {row.recordReference && row.recordHref ? (
                      <a href={row.recordHref} className="font-mono text-primary hover:underline">{row.recordReference}</a>
                    ) : row.recordReference ? (
                      <span className="font-mono">{row.recordReference}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Badge variant="outline" className={statusStyles[row.outcome]}>{row.outcome}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRows.length === 0 ? <EmptyState title="No matching activity" description="Try a different search term or filter." /> : null}
        </div>
        <div className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
          Showing {visibleRows.length} of {totalRows} entries
        </div>
      </section>
    </div>
  )
}
