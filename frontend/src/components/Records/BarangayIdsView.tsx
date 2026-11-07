import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  CalendarClock,
  Clock3,
  CreditCard,
  IdCard,
  RefreshCw,
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { BarangayIdListItem } from "@/client"
import { BarangayIdsService } from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { RowActions } from "@/components/Common/RowActions"
import { StatCard } from "@/components/Common/StatCard"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { formatBusinessDate } from "@/lib/residents"

type StatusFilter = "all" | BarangayIdListItem["status"]

const PAGE_SIZE = 10

const statusLabels: Record<BarangayIdListItem["status"], string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
}

const transactionLabels: Record<string, string> = {
  new: "New",
  renewal: "Renewal",
  replacement: "Replacement",
}

/** Today's business date in Manila, as YYYY-MM-DD. */
function manilaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
}

function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / 86400000)
}

function expiryRelative(validUntil: string) {
  const days = dayNumber(validUntil) - dayNumber(manilaToday())
  if (days === 0) return "today"
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`
  const ago = Math.abs(days)
  if (ago < 30) return `expired ${ago} day${ago === 1 ? "" : "s"} ago`
  const months = Math.floor(ago / 30)
  return `expired ${months} month${months === 1 ? "" : "s"} ago`
}

// Printing a card, renewing and replacing all go through Issuances.
function openIdIssuance(residentId: string) {
  window.location.assign(
    `/issuances?resident=${encodeURIComponent(residentId)}&type=BARANGAY_ID`,
  )
}

function useIdCount(status: StatusFilter) {
  return useQuery({
    queryKey: ["barangay-id-count", status],
    queryFn: async () =>
      (
        await BarangayIdsService.idsListBarangayIds({
          query: { status, limit: 1 },
        })
      ).data.count,
  })
}

export function BarangayIdsView() {
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    )
    return () => window.clearTimeout(timer)
  }, [search])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the filters are the trigger.
  useEffect(() => {
    setPageIndex(0)
  }, [debouncedSearch, statusFilter])

  const idsQuery = useQuery({
    queryKey: ["barangay-ids", debouncedSearch, statusFilter, pageIndex],
    queryFn: async () =>
      (
        await BarangayIdsService.idsListBarangayIds({
          query: {
            q: debouncedSearch || undefined,
            status: statusFilter,
            skip: pageIndex * PAGE_SIZE,
            limit: PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const records = idsQuery.data?.data ?? []
  const total = idsQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total ? pageIndex * PAGE_SIZE + 1 : 0
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, total)

  const allCount = useIdCount("all")
  const validCount = useIdCount("valid")
  const soonCount = useIdCount("expiring_soon")
  const expiredCount = useIdCount("expired")
  const show = (count: number | undefined) =>
    count === undefined ? "—" : String(count)

  return (
    <>
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Barangay ID summary"
      >
        <StatCard
          icon={IdCard}
          label="Residents with an ID"
          value={show(allCount.data)}
          description="Latest issued card"
        />
        <StatCard
          icon={CreditCard}
          label="Valid IDs"
          value={show(validCount.data)}
          description="Current records"
        />
        <StatCard
          icon={Clock3}
          label="Expiring IDs"
          value={show(soonCount.data)}
          description="Approaching expiry"
        />
        <StatCard
          icon={CalendarClock}
          label="Expired IDs"
          value={show(expiredCount.data)}
          description="Requires review"
        />
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">ID Records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each resident's latest issued ID. Check expiry and the next step.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search ID records</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search resident, ID number, or reference"
                className={`${formControlClass} pl-9`}
              />
            </label>
            <label className="sm:w-52">
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className={formControlClass}
              >
                <option value="all">All statuses</option>
                <option value="valid">Valid</option>
                <option value="expiring_soon">Expiring soon</option>
                <option value="expired">Expired</option>
              </select>
            </label>
          </div>
        </div>

        {idsQuery.isLoading ? (
          <LoadingState title="Loading ID records..." />
        ) : idsQuery.isError ? (
          <ErrorState
            title="Could not load ID records"
            description="Check your connection and try again."
            onRetry={() => idsQuery.refetch()}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      "Resident",
                      "ID number",
                      "Card",
                      "Issued",
                      "Valid until",
                      "Status",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        className={`px-4 py-3 align-middle font-medium sm:px-5 ${label === "Actions" ? "text-right" : ""}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => {
                    const archived = record.resident_status === "archived"
                    const statusText = statusLabels[record.status]
                    const needsRenewal =
                      record.status === "expiring_soon" ||
                      record.status === "expired"
                    return (
                      <tr
                        key={record.issuance_id}
                        className={`transition-colors hover:bg-muted/30 ${archived ? "opacity-70" : ""}`}
                      >
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <p className="font-semibold">
                            {record.resident_name}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {record.reference_no}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle font-mono sm:px-5">
                          {record.id_number}
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          {transactionLabels[record.transaction_type] ??
                            record.transaction_type}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          {formatBusinessDate(record.issue_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          <p>{formatBusinessDate(record.valid_until)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {expiryRelative(record.valid_until)}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <div className="flex flex-wrap gap-1">
                            <Badge
                              variant="outline"
                              className={statusStyles[statusText]}
                            >
                              {statusText}
                            </Badge>
                            {archived ? (
                              <Badge
                                variant="outline"
                                className={statusStyles.Archived}
                              >
                                Resident archived
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <RowActions
                            name={record.resident_name}
                            isAdmin={isAdmin}
                            primary={
                              archived
                                ? undefined
                                : needsRenewal
                                  ? {
                                      label: "Renew",
                                      icon: <RefreshCw aria-hidden="true" />,
                                      onSelect: () =>
                                        openIdIssuance(record.resident_id),
                                    }
                                  : {
                                      label: "Replace card",
                                      variant: "outline",
                                      title: "For a lost or damaged card",
                                      onSelect: () =>
                                        openIdIssuance(record.resident_id),
                                    }
                            }
                            items={[
                              {
                                label: "Replace card",
                                hidden: archived || !needsRenewal,
                                title: "For a lost or damaged card",
                                onSelect: () =>
                                  openIdIssuance(record.resident_id),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {records.length === 0 ? (
                <EmptyState
                  title="No ID records match your search"
                  description="Try a different resident, ID number, reference, or status. A resident appears here once a Barangay ID has been issued."
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
    </>
  )
}
