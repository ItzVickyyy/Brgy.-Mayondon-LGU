import { createFileRoute } from "@tanstack/react-router"
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Printer,
  RefreshCw,
  Search,
  X,
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
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export const Route = createFileRoute("/_layout/barangay-ids")({
  component: BarangayIdManagement,
  head: () => ({ meta: [{ title: pageTitle("Barangay ID Management") }] }),
})

type IdStatus = "Valid" | "Expiring soon" | "Expired" | "Archived"

type BarangayIdRecord = {
  reference: string
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

function BarangayIdManagement() {
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"current" | "all" | IdStatus>("current")
  const [registrationFilter, setRegistrationFilter] = useState<"all" | "Registered" | "Unregistered">("all")
  const [notice, setNotice] = useState("")
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

  const showActionNotice = (action: string, record: BarangayIdRecord) => {
    setNotice(`${action} selected for ${record.resident}.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Barangay ID Management
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review existing ID records, check validity, and prepare creation or
            renewal workflows.
          </p>
        </div>
        <Button onClick={() => setNotice("Create Barangay ID selected.")}>
          <CreditCard aria-hidden="true" />
          Create Barangay ID
        </Button>
      </div>

      {notice ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="icon" onClick={() => setNotice("")} aria-label="Dismiss message">
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

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
                      onSelect: () => showActionNotice("Print ID", record),
                    }
                  : record.status === "Expiring soon" || record.status === "Expired"
                    ? {
                        label: "Renew",
                        icon: <RefreshCw aria-hidden="true" />,
                        onSelect: () => showActionNotice("Renew ID", record),
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
                          { label: "Print", hidden: record.status !== "Expiring soon", disabled: !record.photoAvailable, title: record.photoAvailable ? undefined : "Photo required", onSelect: () => showActionNotice("Print ID", record) },
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

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-semibold tracking-tight">ID Validity and Registration</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>Preserve the barangay's current ID numbering series and determine how the next number is assigned.</li>
          <li>Standard IDs are valid for one year. New or renting residents may have six-month validity.</li>
          <li>Registration status is maintained with the resident record.</li>
          <li>Use the client-approved ID layout and test photo placement, print scaling, and physical card dimensions.</li>
          <li>Retain expired or archived ID history instead of silently overwriting prior records.</li>
        </ul>
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
          setNotice(`Validity override for ${overrideTarget.resident} requires review: ${reason}`)
          setOverrideTarget(null)
        }}
      />
    </div>
  )
}
