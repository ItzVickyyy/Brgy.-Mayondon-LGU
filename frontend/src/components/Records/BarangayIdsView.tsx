import {
  Archive,
  CalendarClock,
  Clock3,
  CreditCard,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { TablePagination, usePagination } from "@/components/Common/TablePagination"
import { RowActions } from "@/components/Common/RowActions"
import { StatCard } from "@/components/Common/StatCard"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

type IdStatus = "Valid" | "Expiring soon" | "Expired" | "Archived"

type BarangayIdRecord = {
  reference: string
  residentId: string
  resident: string
  idNumber: string
  registrationStatus: "Registered" | "Unregistered"
  expiresOn: string
  status: IdStatus
  photoAvailable: boolean
}

const sampleIds: BarangayIdRecord[] = []

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
}

function expiryRelative(value: string) {
  const expires = new Date(`${value}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.ceil((expires.getTime() - today.getTime()) / 86400000)
  if (days >= 0) return `in ${days} day${days === 1 ? "" : "s"}`
  const months = Math.max(1, Math.floor(Math.abs(days) / 30))
  return `expired ${months} month${months === 1 ? "" : "s"} ago`
}

export function BarangayIdsView({ onNotice }: { onNotice: (message: string) => void }) {
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"current" | "all" | IdStatus>("current")
  const [registrationFilter, setRegistrationFilter] = useState<"all" | "Registered" | "Unregistered">("all")
  const [overrideTarget, setOverrideTarget] = useState<BarangayIdRecord | null>(null)

  const filteredIds = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sampleIds
      .filter((record) => {
        const matchesSearch = [record.resident, record.idNumber].some((value) =>
          value.toLowerCase().includes(query),
        )
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "current" ? record.status !== "Archived" : record.status === statusFilter)
        const matchesRegistration =
          registrationFilter === "all" || record.registrationStatus === registrationFilter
        return matchesSearch && matchesStatus && matchesRegistration
      })
      .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))
  }, [registrationFilter, search, statusFilter])
  const idPagination = usePagination(filteredIds, 10, search + "|" + statusFilter + "|" + registrationFilter)

  // Printing and renewing go through Issuance Management: open New Issuance with this resident and the Barangay ID type already chosen.
  const openIdIssuance = (record: BarangayIdRecord) => {
    window.location.assign(`/issuances?resident=${encodeURIComponent(record.residentId)}&type=BARANGAY_ID`)
  }

  const showActionNotice = (action: string, record: BarangayIdRecord) => {
    onNotice(`${action} selected for ${record.resident}.`)
  }

  return (
    <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Barangay ID summary">
          <StatCard icon={CreditCard} label="Valid IDs" value={String(sampleIds.filter((record) => record.status === "Valid").length)} description="Current records" />
          <StatCard icon={Clock3} label="Expiring IDs" value={String(sampleIds.filter((record) => record.status === "Expiring soon").length)} description="Approaching expiry" />
          <StatCard icon={CalendarClock} label="Expired IDs" value={String(sampleIds.filter((record) => record.status === "Expired").length)} description="Requires review" />
          <StatCard icon={Archive} label="Archived Records" value={String(sampleIds.filter((record) => record.status === "Archived").length)} description="Archived records" />
        </section>

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
            <div>
              <h2 className="font-semibold tracking-tight">ID Records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check registration, expiry, and the next step for each ID.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="relative block min-w-0 flex-1 sm:max-w-sm">
                <span className="sr-only">Search ID records</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resident or ID number" className={`${formControlClass} pl-9`} />
              </label>
              <label className="sm:w-52">
                <span className="sr-only">Filter by status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "current" | "all" | IdStatus)} className={formControlClass}>
                  <option value="current">All active statuses</option>
                  <option>Valid</option>
                  <option>Expiring soon</option>
                  <option>Expired</option>
                  <option>Archived</option>
                  <option value="all">All statuses</option>
                </select>
              </label>
              <label className="sm:w-52">
                <span className="sr-only">Filter by registration</span>
                <select value={registrationFilter} onChange={(event) => setRegistrationFilter(event.target.value as "all" | "Registered" | "Unregistered")} className={formControlClass}>
                  <option value="all">All registration states</option>
                  <option>Registered</option>
                  <option>Unregistered</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Resident", "ID number", "Registration", "Valid until", "Status", "Actions"].map((label) => (
                    <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 align-middle font-medium sm:px-5"}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {idPagination.paginatedItems.map((record) => {
                  const archived = record.status === "Archived"
                  const primaryAction = record.status === "Valid"
                    ? {
                        label: "Print",
                        variant: "outline" as const,
                        icon: <Printer aria-hidden="true" />,
                        disabled: !record.photoAvailable,
                        title: record.photoAvailable ? undefined : "Photo required",
                        onSelect: () => openIdIssuance(record),
                      }
                    : record.status === "Expiring soon" || record.status === "Expired"
                      ? {
                          label: "Renew",
                          icon: <RefreshCw aria-hidden="true" />,
                          onSelect: () => openIdIssuance(record),
                        }
                      : undefined
                  return (
                    <tr key={record.reference} className={`transition-colors hover:bg-muted/30 ${archived ? "opacity-70" : ""}`}>
                      <td className="px-4 py-3 align-middle sm:px-5">
                        <p className="font-semibold">{record.resident}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle font-mono sm:px-5">{record.idNumber}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">{record.registrationStatus}</td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                        <p>{formatDate(record.expiresOn)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{expiryRelative(record.expiresOn)}</p>
                      </td>
                      <td className="px-4 py-3 align-middle sm:px-5"><Badge variant="outline" className={statusStyles[record.status]}>{record.status}</Badge></td>
                      <td className="px-4 py-3 align-middle sm:px-5">
                        <RowActions
                          name={record.resident}
                          isAdmin={isAdmin}
                          primary={primaryAction}
                          items={[
                            { label: "View details", onSelect: () => showActionNotice("View ID details", record) },
                            { label: "Print", hidden: record.status !== "Expiring soon", disabled: !record.photoAvailable, title: record.photoAvailable ? undefined : "Photo required", onSelect: () => openIdIssuance(record) },
                            { label: "Edit photo / details", hidden: !(record.status === "Valid" || record.status === "Expiring soon"), onSelect: () => showActionNotice("Edit photo / details", record) },
                            { label: "Override validity", adminOnly: true, hidden: archived, destructive: true, onSelect: () => setOverrideTarget(record) },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredIds.length === 0 ? <EmptyState title="No ID records match your search" description="Try a different resident, ID number, registration state, or status." /> : null}
          </div>
          <TablePagination start={idPagination.start} end={idPagination.end} total={idPagination.total} pageIndex={idPagination.pageIndex} pageCount={idPagination.pageCount} onPageChange={idPagination.setPageIndex} />
        </section>

        <ConfirmDialog
          open={overrideTarget !== null}
          onOpenChange={(open) => { if (!open) setOverrideTarget(null) }}
          title="Override ID validity?"
          description={overrideTarget ? `Record a validity override request for ${overrideTarget.resident}. A reason is required for the audit trail.` : "Confirm the validity override."}
          confirmLabel="Confirm override"
          destructive
          reason="required"
          onConfirm={(reason) => {
            if (!overrideTarget) return
            onNotice(`Validity override for ${overrideTarget.resident} requires review: ${reason}`)
            setOverrideTarget(null)
          }}
        />
    </>
  )
}
