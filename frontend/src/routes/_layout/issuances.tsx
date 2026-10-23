import { createFileRoute } from "@tanstack/react-router"
import { FileCheck2, Info, Printer, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/issuances")({
  component: IssuancesManagement,
  head: () => ({ meta: [{ title: pageTitle("Issuances Management") }] }),
})

const documentTypes = [
  "Barangay ID",
  "Barangay Clearance",
  "Barangay Clearance (Electrical and Water Connection)",
  "Barangay Franchise Clearance",
  "Certificate of Indigency",
  "Certificate of Residency",
  "Other Certificate",
]

const sampleIssuances = [
  { id: "ISS-2026-001", resident: "Sample Resident One", type: "Barangay Clearance", date: "Oct 23, 2026", status: "Issued" },
  { id: "ISS-2026-002", resident: "Sample Resident Two", type: "Certificate of Residency", date: "Oct 23, 2026", status: "Issued" },
  { id: "ISS-2026-003", resident: "Sample Resident Three", type: "Certificate of Indigency", date: "Oct 22, 2026", status: "Issued" },
  { id: "ISS-2026-004", resident: "Sample Resident Four", type: "Barangay ID", date: "Oct 22, 2026", status: "Issued" },
  { id: "ISS-2026-005", resident: "Sample Resident Five", type: "Barangay Franchise Clearance", date: "Oct 21, 2026", status: "Issued" },
]

function IssuancesManagement() {
  const [activeTab, setActiveTab] = useState<"issue" | "history">("issue")
  const [selectedType, setSelectedType] = useState(documentTypes[1])
  const [search, setSearch] = useState("")
  const [residentName, setResidentName] = useState("")
  const [purpose, setPurpose] = useState("")
  const filteredIssuances = useMemo(() => sampleIssuances.filter((item) =>
    [item.id, item.resident, item.type, item.date, item.status].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  ), [search])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin Portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Issuances Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">Proposed workflow for issuing barangay documents and reviewing issuance history.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>Draft preview only. Form entries are not saved, documents are not generated, and the sample history is fictional.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        <button type="button" onClick={() => setActiveTab("issue")} className={`border-b-2 px-4 py-3 text-sm font-medium ${activeTab === "issue" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Issue Document</button>
        <button type="button" onClick={() => setActiveTab("history")} className={`border-b-2 px-4 py-3 text-sm font-medium ${activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Issuance History</button>
      </div>

      {activeTab === "issue" ? (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileCheck2 className="size-5" aria-hidden="true" /></div>
            <div><h2 className="font-semibold">Document Details</h2><p className="mt-1 text-sm text-muted-foreground">Select a document type and enter the resident details for the proposed workflow.</p></div>
          </div>
          <form onSubmit={(event) => event.preventDefault()} className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">Document Type
              <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="h-10 rounded-md border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Resident Name
              <input value={residentName} onChange={(event) => setResidentName(event.target.value)} placeholder="Enter resident name (sample only)" className="h-10 rounded-md border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">Purpose / Notes
              <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} rows={3} placeholder="Enter purpose or details required for this document" className="rounded-md border bg-background px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground md:col-span-2">
              <p className="font-medium text-foreground">Draft selection summary</p>
              <p className="mt-1">Document: {selectedType}</p>
              <p>Resident: {residentName.trim() || "Not entered"}</p>
              <p>Notes: {purpose.trim() || "None entered"}</p>
              <p className="mt-2 text-xs">The final form fields, requirements, fees, approval steps, and print template must be confirmed with the barangay.</p>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button type="button" onClick={() => { setResidentName(""); setPurpose("") }} className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted">Clear Form</button>
              <button type="button" onClick={() => setActiveTab("history")} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">View Issuance History</button>
            </div>
          </form>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold">Issuance History</h2><p className="mt-1 text-sm text-muted-foreground">Search the sample list of issued documents.</p></div>
            <label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search issuance history..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Issuance ID</th><th className="px-4 py-3 font-medium">Resident</th><th className="px-4 py-3 font-medium">Document Type</th><th className="px-4 py-3 font-medium">Date Issued</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
              <tbody className="divide-y">{filteredIssuances.map((item) => <tr key={item.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{item.id}</td><td className="px-4 py-3">{item.resident}</td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{item.date}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{item.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"><Printer className="size-3.5" aria-hidden="true" />Print list</button></td></tr>)}</tbody>
            </table>
            {filteredIssuances.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No sample issuances match your search.</p>}
          </div>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">Print is a browser print action for the current page, not an official document printout.</div>
        </section>
      )}
    </div>
  )
}
