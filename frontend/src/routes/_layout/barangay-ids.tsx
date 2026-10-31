import { createFileRoute, redirect } from "@tanstack/react-router"
import { CreditCard, Search, UserRound, CalendarClock, Printer, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/barangay-ids")({
  beforeLoad: () => {
    throw redirect({ to: "/issuances" })
  },
  component: BarangayIdManagement,
  head: () => ({ meta: [{ title: pageTitle("Issuance Management") }] }),
})

type IdStatus = "Valid" | "Expiring soon" | "Expired" | "Archived"

type BarangayIdRecord = {
  reference: string
  resident: string
  idNumber: string
  residentType: string
  registrationStatus: "Registered" | "Unregistered"
  issuedOn: string
  expiresOn: string
  status: IdStatus
}

const sampleIds: BarangayIdRecord[] = [
  {
    reference: "ID-0001",
    resident: "Resident One",
    idNumber: "18-128-3597-0001",
    residentType: "Existing resident",
    registrationStatus: "Registered",
    issuedOn: "2026-01-15",
    expiresOn: "2027-01-15",
    status: "Valid",
  },
  {
    reference: "ID-0002",
    resident: "Resident Two",
    idNumber: "18-128-3597-0001",
    residentType: "New / renting resident",
    registrationStatus: "Unregistered",
    issuedOn: "2026-05-20",
    expiresOn: "2026-11-20",
    status: "Expiring soon",
  },
  {
    reference: "ID-0003",
    resident: "Resident Three",
    idNumber: "18-128-3597-0001",
    residentType: "Existing resident",
    registrationStatus: "Registered",
    issuedOn: "2024-08-01",
    expiresOn: "2025-08-01",
    status: "Expired",
  },
  {
    reference: "ID-0004",
    resident: "Resident Four",
    idNumber: "18-128-3597-0001",
    residentType: "Existing resident",
    registrationStatus: "Unregistered",
    issuedOn: "2025-03-12",
    expiresOn: "2026-03-12",
    status: "Archived",
  },
]

const statusStyles: Record<IdStatus, string> = {
  Valid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  "Expiring soon": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  Expired: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  Archived: "border-border bg-muted text-muted-foreground",
}

function BarangayIdManagement() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | IdStatus>("All")
  const [notice, setNotice] = useState("")

  const filteredIds = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sampleIds.filter((record) => {
      const matchesSearch = [
        record.reference,
        record.resident,
        record.idNumber,
        record.residentType,
        record.registrationStatus,
        record.status,
      ].some((value) => value.toLowerCase().includes(query))
      return matchesSearch && (statusFilter === "All" || record.status === statusFilter)
    })
  }, [search, statusFilter])

  const showActionNotice = (action: string) => {
    setNotice(`${action} selected.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Resident Services</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Barangay ID Management</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review existing ID records, check validity, and prepare creation or renewal workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => showActionNotice("Create Barangay ID")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <CreditCard className="size-4" aria-hidden="true" />
          Create Barangay ID
        </button>
      </div>


      {notice && <div role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">{notice}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Barangay ID summary">
        {[
          { label: "Valid IDs", value: "4", description: "Current records" },
          { label: "Expiring IDs", value: "1", description: "Approaching expiry" },
          { label: "Expired IDs", value: "1", description: "Requires review" },
          { label: "Archived Records", value: "1", description: "Archived records" },
        ].map((item) => (
          <article key={item.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">ID Records</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search by resident, ID reference, resident type, or status.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <label className="relative block">
              <span className="sr-only">Search ID records</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ID records..."
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "All" | IdStatus)}
                className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option>All</option>
                <option>Valid</option>
                <option>Expiring soon</option>
                <option>Expired</option>
                <option>Archived</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Resident / Reference</th>
                <th className="px-4 py-3 font-medium">ID Number</th>
                <th className="px-4 py-3 font-medium">Resident Type</th>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIds.map((record) => (
                <tr key={record.reference} className="align-top hover:bg-muted/20">
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                        <UserRound className="size-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium">{record.resident}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{record.reference}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{record.idNumber}</td>
                  <td className="px-4 py-4">{record.residentType}</td>
                  <td className="px-4 py-4">{record.registrationStatus}</td>
                  <td className="whitespace-nowrap px-4 py-4">{record.issuedOn}</td>
                  <td className="whitespace-nowrap px-4 py-4">{record.expiresOn}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[record.status]}`}>{record.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => showActionNotice("View ID details")} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                        Details
                      </button>
                      <button type="button" onClick={() => showActionNotice("Renew ID")} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                        <RefreshCw className="size-3.5" aria-hidden="true" /> Renew
                      </button>
                      <button type="button" onClick={() => showActionNotice("Print ID")} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                        <Printer className="size-3.5" aria-hidden="true" /> Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No ID records match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-1 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {filteredIds.length} record{filteredIds.length === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" aria-hidden="true" /> Expiry and renewal</span>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold tracking-tight">ID Validity and Registration</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>Preserve the barangay's current ID numbering series and determine how the next number is assigned.</li>
          <li>Standard IDs are valid for one year. New or renting residents may have six-month validity.</li>
          <li>Registration status is maintained with the resident record.</li>
          <li>Use the client-approved ID layout and test photo placement, print scaling, and physical card dimensions.</li>
          <li>Retain expired or archived ID history instead of silently overwriting prior records.</li>
        </ul>
      </section>
    </div>
  )
}
