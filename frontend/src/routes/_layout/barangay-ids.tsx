import { createFileRoute } from "@tanstack/react-router"
import {
  Archive,
  CalendarClock,
  Clock3,
  CreditCard,
  Printer,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/Common/FeedbackState"
import { StatCard } from "@/components/Common/StatCard"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/barangay-ids")({
  component: BarangayIdManagement,
  head: () => ({ meta: [{ title: pageTitle("Barangay ID Management") }] }),
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
    idNumber: "18-128-3597-0002",
    residentType: "New / renting resident",
    registrationStatus: "Unregistered",
    issuedOn: "2026-05-20",
    expiresOn: "2026-11-20",
    status: "Expiring soon",
  },
  {
    reference: "ID-0003",
    resident: "Resident Three",
    idNumber: "18-128-3597-0003",
    residentType: "Existing resident",
    registrationStatus: "Registered",
    issuedOn: "2024-08-01",
    expiresOn: "2025-08-01",
    status: "Expired",
  },
  {
    reference: "ID-0004",
    resident: "Resident Four",
    idNumber: "18-128-3597-0004",
    residentType: "Existing resident",
    registrationStatus: "Unregistered",
    issuedOn: "2025-03-12",
    expiresOn: "2026-03-12",
    status: "Archived",
  },
]

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
      return (
        matchesSearch &&
        (statusFilter === "All" || record.status === statusFilter)
      )
    })
  }, [search, statusFilter])

  const showActionNotice = (action: string) => {
    setNotice(`${action} selected.`)
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
        <Button onClick={() => showActionNotice("Create Barangay ID")}>
          <CreditCard aria-hidden="true" />
          Create Barangay ID
        </Button>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          {notice}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Barangay ID summary">
        <StatCard icon={CreditCard} label="Valid IDs" value="4" description="Current records" />
        <StatCard icon={Clock3} label="Expiring IDs" value="1" description="Approaching expiry" />
        <StatCard icon={CalendarClock} label="Expired IDs" value="1" description="Requires review" />
        <StatCard icon={Archive} label="Archived Records" value="1" description="Archived records" />
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">ID Records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by resident, ID reference, resident type, or status.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <span className="sr-only">Search ID records</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ID records..."
                className={`${formControlClass} pl-9`}
              />
            </label>
            <label className="sm:w-52">
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "All" | IdStatus)
                }
                className={formControlClass}
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
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Resident / Reference</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">ID Number</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Resident Type</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Registration</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Issued</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Expires</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Status</th>
                <th className="px-4 py-3 text-right align-middle font-medium sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIds.map((record) => (
                <tr
                  key={record.reference}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                        <UserRound className="size-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium">{record.resident}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {record.reference}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">
                    {record.idNumber}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">{record.residentType}</td>
                  <td className="px-4 py-3 align-middle sm:px-5">{record.registrationStatus}</td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {record.issuedOn}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {record.expiresOn}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Badge variant="outline" className={statusStyles[record.status]}>{record.status}</Badge>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => showActionNotice("View ID details")}>Details</Button>
                      <Button variant="outline" size="sm" onClick={() => showActionNotice("Renew ID")}><RefreshCw aria-hidden="true" /> Renew</Button>
                      <Button variant="outline" size="sm" onClick={() => showActionNotice("Print ID")}><Printer aria-hidden="true" /> Print</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIds.length === 0 && (
                
              )}
            </tbody>
          </table>
        </div>
        {filteredIds.length === 0 ? <EmptyState title="No ID records match your search" description="Try a different search term or status filter." /> : null}
        <div className="flex flex-col gap-1 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {filteredIds.length} record
            {filteredIds.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden="true" /> Expiry and
            renewal
          </span>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold tracking-tight">
          ID Validity and Registration
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>
            Preserve the barangay's current ID numbering series and determine
            how the next number is assigned.
          </li>
          <li>
            Standard IDs are valid for one year. New or renting residents may
            have six-month validity.
          </li>
          <li>Registration status is maintained with the resident record.</li>
          <li>
            Use the client-approved ID layout and test photo placement, print
            scaling, and physical card dimensions.
          </li>
          <li>
            Retain expired or archived ID history instead of silently
            overwriting prior records.
          </li>
        </ul>
      </section>
    </div>
  )
}
