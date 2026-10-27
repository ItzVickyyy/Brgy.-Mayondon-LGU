import { createFileRoute } from "@tanstack/react-router"
import { FileUp, Search, Users, UserRound, Upload } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/records")({
  component: RecordsManagement,
  head: () => ({ meta: [{ title: pageTitle("Resident Records") }] }),
})

type View = "residents" | "family-sector" | "import"

const sampleResidents = [
  { id: "SAMPLE-0001", name: "Sample Resident One", address: "Sample Address One", residentType: "Existing resident", idNumber: "Sample ID series", registration: "Registered", status: "Active" },
  { id: "SAMPLE-0002", name: "Sample Resident Two", address: "Sample Address Two", residentType: "New / renting resident", idNumber: "Sample ID series", registration: "Unregistered", status: "Active" },
  { id: "SAMPLE-0003", name: "Sample Resident Three", address: "Sample Address Three", residentType: "Existing resident", idNumber: "Sample ID series", registration: "Registered", status: "Active" },
  { id: "SAMPLE-0004", name: "Sample Resident Four", address: "Sample Address Four", residentType: "Existing resident", idNumber: "Sample ID series", registration: "Unregistered", status: "Archived" },
]

const inputClass = "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

function RecordsManagement() {
  const [view, setView] = useState<View>("residents")
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState("")
  const [selectedFile, setSelectedFile] = useState("")

  const filteredResidents = useMemo(() => sampleResidents.filter((resident) =>
    [resident.id, resident.name, resident.address, resident.residentType, resident.idNumber, resident.registration, resident.status]
      .some((value) => value.toLowerCase().includes(search.toLowerCase())),
  ), [search])

  const tabs: { id: View; label: string }[] = [
    { id: "residents", label: "Residents" },
    { id: "family-sector", label: "Family & Sector Details" },
    { id: "import", label: "Import Masterlist" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Records</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Resident Records</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Search and maintain resident information, related family and sector details, and existing Barangay ID references.
          </p>
        </div>
        <button type="button" onClick={() => setNotice("Resident creation is a design prototype. Database saving is not connected yet.")} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <UserRound className="size-4" aria-hidden="true" /> Add Resident
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3" role="tablist" aria-label="Resident record views">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} onClick={() => { setView(tab.id); setNotice("") }} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${view === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {notice && <div role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">{notice}</div>}

      {view === "residents" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Resident Records</p>
              <p className="mt-2 text-2xl font-semibold">Sample data</p>
              <p className="mt-1 text-xs text-muted-foreground">No actual barangay totals shown</p>
            </article>
            <article className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">ID and Registration Details</p>
              <p className="mt-2 text-2xl font-semibold">Included</p>
              <p className="mt-1 text-xs text-muted-foreground">Final rules need client confirmation</p>
            </article>
            <article className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Record Removal</p>
              <p className="mt-2 text-2xl font-semibold">Archive</p>
              <p className="mt-1 text-xs text-muted-foreground">Prefer inactive status over permanent deletion</p>
            </article>
          </div>

          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Resident List</h2>
                <p className="mt-1 text-sm text-muted-foreground">Prototype rows only. Do not enter real resident data into this draft.</p>
              </div>
              <label className="relative block w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, address, ID, or status..." className={`${inputClass} pl-9`} />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{["Resident Reference", "Resident Name", "Address", "Resident Type", "ID Reference", "Registration", "Record Status", "Action"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {filteredResidents.map((resident) => (
                    <tr key={resident.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{resident.id}</td>
                      <td className="px-4 py-3">{resident.name}</td>
                      <td className="px-4 py-3">{resident.address}</td>
                      <td className="px-4 py-3">{resident.residentType}</td>
                      <td className="px-4 py-3">{resident.idNumber}</td>
                      <td className="px-4 py-3">{resident.registration}</td>
                      <td className="px-4 py-3"><span className="rounded-full border px-2 py-1 text-xs">{resident.status}</span></td>
                      <td className="px-4 py-3"><button type="button" onClick={() => setNotice(`Resident profile for ${resident.name} is a prototype. Profile editing and database persistence are not connected.`)} className="font-medium text-primary hover:underline">View profile</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResidents.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No sample records match your search.</p>}
            </div>
          </section>
        </>
      )}

      {view === "family-sector" && (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Family, Beneficiary, and Marginalized-Sector Details</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">This section is intended to organize related details required by the barangay's current workflow. Confirm the exact fields and sector categories with the client before finalizing the form.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Family Details</h3>
              <p className="mt-1 text-sm text-muted-foreground">Family or household reference, relationship to household member, and related resident records.</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Beneficiary Details</h3>
              <p className="mt-1 text-sm text-muted-foreground">Beneficiary information required by approved barangay forms and existing masterlists.</p>
            </div>
            <div className="rounded-lg border p-4 md:col-span-2">
              <h3 className="font-medium">Marginalized-Sector Details</h3>
              <p className="mt-1 text-sm text-muted-foreground">Sector categories based on the client-provided sheets. Only collect fields the client confirms are needed.</p>
            </div>
          </div>
          <p className="mt-4 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">Design draft only. The final data fields and access rules still need confirmation.</p>
        </section>
      )}

      {view === "import" && (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <FileUp className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Import Existing Masterlist</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Prepare a controlled import from client-provided spreadsheets. Validate the file and preview changes before anything is saved.</p>
            </div>
          </div>
          <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center hover:bg-muted/30">
            <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{selectedFile || "Choose a masterlist file"}</span>
            <span className="text-sm text-muted-foreground">Select a spreadsheet file for the design preview</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(event) => { setSelectedFile(event.target.files?.[0]?.name ?? ""); setNotice("") }} />
          </label>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Preview rows", "Not generated"],
              ["Validation errors", "Not checked"],
              ["Possible duplicates", "Not checked"],
              ["Import result", "Not imported"],
            ].map(([label, value]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>)}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">The upload control is a visual draft only. File parsing, preview, duplicate detection, and database import are not implemented yet.</p>
        </section>
      )}
    </div>
  )
}
