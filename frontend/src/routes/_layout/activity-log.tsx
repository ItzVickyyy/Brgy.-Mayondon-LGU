import { createFileRoute } from "@tanstack/react-router"
import { Filter, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/Common/FeedbackState"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/activity-log")({
  component: ActivityLog,
  head: () => ({ meta: [{ title: pageTitle("Activity Log") }] }),
})

const rows = [
  {
    time: "Oct 28, 2026 · 10:42 AM",
    user: "admin",
    owner: "admin",
    action: "Updated resident details",
    module: "Resident Records",
    outcome: "Success",
  },
  {
    time: "Oct 28, 2026 · 9:55 AM",
    user: "staff",
    owner: "current",
    action: "Prepared document request",
    module: "Document Management",
    outcome: "In progress",
  },
  {
    time: "Oct 28, 2026 · 8:04 AM",
    user: "staff",
    owner: "staff",
    action: "Signed in to the system",
    module: "Authentication",
    outcome: "Success",
  },
  {
    time: "Oct 27, 2026 · 4:10 PM",
    user: "admin",
    owner: "admin",
    action: "Changed user account status",
    module: "User Accounts",
    outcome: "Success",
  },
  {
    time: "Oct 27, 2026 · 3:32 PM",
    user: "staff",
    owner: "staff",
    action: "Imported masterlist",
    module: "Resident Records",
    outcome: "Completed",
  },
]

function ActivityLog() {
  const { user } = useAuth()
  const isAdmin = Boolean(user?.is_superuser)
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (isAdmin || row.owner === "current") &&
          (moduleFilter === "all" || row.module === moduleFilter) &&
          [row.time, row.user, row.action, row.module, row.outcome].some(
            (value) => value.toLowerCase().includes(search.toLowerCase()),
          ),
      ),
    [isAdmin, moduleFilter, search],
  )

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
              Review and filter recorded system activity.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search activity</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isAdmin
                    ? "Search user, action, or module"
                    : "Search your activity"
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </label>
            <label className="sm:w-52">
              <span className="sr-only">Filter by module</span>
              <select
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="all">All modules</option>
                <option>Resident Records</option>
                <option>Document Management</option>
                <option>User Accounts</option>
                <option>Authentication</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {(isAdmin
                  ? ["Timestamp", "User", "Action", "Module", "Outcome"]
                  : ["Timestamp", "Action", "Module", "Outcome"]
                ).map((item) => (
                  <th key={item} className="px-4 py-3 font-medium sm:px-5">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.map((row) => (
                <tr
                  key={row.time + row.action}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 align-middle sm:px-5">{row.time}</td>
                  {isAdmin ? (
                    <td className="px-4 py-3 align-middle font-medium sm:px-5">
                      {row.user}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 align-middle font-medium sm:px-5">
                    {row.action}
                  </td>
                  <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">
                    {row.module}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Badge variant="outline" className={statusStyles[row.outcome]}>
                      {row.outcome}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRows.length === 0 ? (
            <EmptyState
              title="No matching activity"
              description="Try a different search term or module filter."
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <span>
            Showing {visibleRows.length} entr{visibleRows.length === 1 ? "y" : "ies"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Filter className="size-3.5" aria-hidden="true" />
            Activity records
          </span>
        </div>
      </section>
    </div>
  )
}
