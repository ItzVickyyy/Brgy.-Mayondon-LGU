import { createFileRoute } from "@tanstack/react-router"
import { Clock3, Search, UserRoundCheck } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { NoPermission } from "@/components/Common/NoPermission"
import { RowActions } from "@/components/Common/RowActions"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  TablePagination,
  usePagination,
} from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import {
  type Registration,
  type RegistrationStatus,
  updateRegistrationStatus,
  useRegistrations,
} from "@/lib/registration-store"

export const Route = createFileRoute("/_layout/pending-registrations")({
  component: PendingRegistrations,
  head: () => ({ meta: [{ title: pageTitle("Pending Registrations") }] }),
})

function PendingRegistrations() {
  const { user } = useAuth()
  const registrations = useRegistrations()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | RegistrationStatus>(
    "Pending",
  )
  const [pendingDecision, setPendingDecision] = useState<{
    row: Registration
    status: "Approved" | "Rejected"
  } | null>(null)

  const visibleRegistrations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return registrations
      .filter((row) => {
        const matchesSearch = [
          row.name,
          row.position,
          row.username,
          row.submitted,
          row.status,
          row.decidedBy ?? "",
          row.decidedOn ?? "",
        ].some((value) => value.toLowerCase().includes(query))
        return (
          matchesSearch &&
          (statusFilter === "all" || row.status === statusFilter)
        )
      })
      .sort((a, b) => {
        if (a.status === "Pending" && b.status !== "Pending") return -1
        if (a.status !== "Pending" && b.status === "Pending") return 1
        return new Date(a.submitted).getTime() - new Date(b.submitted).getTime()
      })
  }, [registrations, search, statusFilter])
  const registrationPagination = usePagination(
    visibleRegistrations,
    10,
    `${search}|${statusFilter}`,
  )

  const isAdmin = isSystemAdministrator(user)
  if (!isAdmin) return <NoPermission />

  const pendingCount = registrations.filter(
    (row) => row.status === "Pending",
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Pending Registrations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review and manage staff access requests.
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Access Requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the applicant details before deciding.
              </p>
            </div>
            <span className="inline-flex min-h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold">
              <Clock3 className="size-4" aria-hidden="true" />
              {pendingCount} pending
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search registrations</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search applicants..."
                className={`${formControlClass} pl-9`}
              />
            </label>
            <label className="sm:w-52">
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | RegistrationStatus,
                  )
                }
                className={formControlClass}
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="all">All statuses</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  "Applicant",
                  "Position",
                  "Email / Username",
                  "Submitted",
                  "Status",
                  "Actions",
                ].map((item) => (
                  <th
                    key={item}
                    className={`px-4 py-3 font-medium align-middle sm:px-5 ${item === "Actions" ? "text-right" : ""}`}
                  >
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {registrationPagination.paginatedItems.map((row) => (
                <tr
                  key={row.username}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <div className="flex items-start gap-2">
                      <UserRoundCheck
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="font-medium">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    {row.position}
                  </td>
                  <td className="px-4 py-3 align-middle font-medium sm:px-5">
                    {row.username}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    {row.submitted}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        variant="outline"
                        className={statusStyles[row.status]}
                      >
                        {row.status}
                      </Badge>
                      {row.decidedBy && row.decidedOn ? (
                        <span className="text-xs text-muted-foreground">
                          by {row.decidedBy} · {row.decidedOn}
                        </span>
                      ) : null}
                      {row.rejectionReason ? (
                        <span className="text-xs text-muted-foreground">
                          Reason: {row.rejectionReason}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    {row.status === "Pending" ? (
                      <RowActions
                        name={row.name}
                        isAdmin={isAdmin}
                        primary={{
                          label: "Approve as Staff",
                          onSelect: () =>
                            setPendingDecision({ row, status: "Approved" }),
                        }}
                        items={[
                          {
                            label: "Reject",
                            onSelect: () =>
                              setPendingDecision({ row, status: "Rejected" }),
                            destructive: true,
                          },
                        ]}
                      />
                    ) : (
                      <span className="block text-right text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRegistrations.length === 0 ? (
            <EmptyState
              title="No registrations found"
              description={
                registrations.length === 0
                  ? "Staff sign-up requests are not available yet, so this list stays empty. An administrator adds staff accounts under User Accounts."
                  : "Try a different applicant name, username, date, or status."
              }
            />
          ) : null}
        </div>
        <TablePagination
          start={registrationPagination.start}
          end={registrationPagination.end}
          total={registrationPagination.total}
          pageIndex={registrationPagination.pageIndex}
          pageCount={registrationPagination.pageCount}
          onPageChange={registrationPagination.setPageIndex}
        />
      </section>

      <ConfirmDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDecision(null)
        }}
        title={
          pendingDecision?.status === "Approved"
            ? "Approve access request?"
            : "Reject access request?"
        }
        description={
          pendingDecision
            ? `Are you sure you want to ${pendingDecision.status.toLowerCase()} ${pendingDecision.row.name}'s request?`
            : "Confirm this registration decision."
        }
        confirmLabel={
          pendingDecision?.status === "Approved"
            ? "Approve as Staff"
            : "Reject request"
        }
        destructive={pendingDecision?.status === "Rejected"}
        reason={pendingDecision?.status === "Rejected" ? "optional" : "none"}
        onConfirm={(reason) => {
          if (!pendingDecision) return
          updateRegistrationStatus(
            pendingDecision.row.username,
            pendingDecision.status,
            user?.email ?? "admin",
            reason,
          )
          setPendingDecision(null)
        }}
      />
    </div>
  )
}
