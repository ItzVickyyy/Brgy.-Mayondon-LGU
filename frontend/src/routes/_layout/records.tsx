import { createFileRoute } from "@tanstack/react-router"
import { FileUp, Search, Users, UserRound, Upload, CreditCard, FileCheck2 } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export const Route = createFileRoute("/_layout/records")({
  component: RecordsManagement,
  head: () => ({ meta: [{ title: pageTitle("Resident Records") }] }),
})

type View = "residents" | "family-sector" | "import"

const sampleResidents = [
  { id: "RES-0001", name: "Resident One", address: "Mayondon, Los Baños", residentType: "Existing resident", idNumber: "18-128-3597-0001", registration: "Registered", status: "Active" },
  { id: "RES-0002", name: "Resident Two", address: "Mayondon, Los Baños", residentType: "New / renting resident", idNumber: "18-128-3597-0002", registration: "Unregistered", status: "Active" },
  { id: "RES-0003", name: "Resident Three", address: "Mayondon, Los Baños", residentType: "Existing resident", idNumber: "18-128-3597-0003", registration: "Registered", status: "Active" },
  { id: "RES-0004", name: "Resident Four", address: "Mayondon, Los Baños", residentType: "Existing resident", idNumber: "18-128-3597-0004", registration: "Unregistered", status: "Archived" },
]

const inputClass = "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

function RecordsManagement() {
  const [view, setView] = useState<View>("residents")
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState("")
  const [selectedFile, setSelectedFile] = useState("")
  const [selectedResident, setSelectedResident] = useState<(typeof sampleResidents)[number] | null>(null)
  const [profileTab, setProfileTab] = useState("Details")

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
        <button type="button" onClick={() => setNotice("Resident record form opened.")} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
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
              <p className="mt-2 text-2xl font-semibold">4</p>
              <p className="mt-1 text-xs text-muted-foreground">Resident records in this view</p>
            </article>
            <article className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">ID and Registration Details</p>
              <p className="mt-2 text-2xl font-semibold">Included</p>
              <p className="mt-1 text-xs text-muted-foreground">Resident registration and ID details</p>
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
                <p className="mt-1 text-sm text-muted-foreground">Resident records</p>
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
                      <td className="px-4 py-3"><button type="button" onClick={() => { setSelectedResident(resident); setProfileTab("Details") }} className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View profile</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResidents.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No records match your search.</p>}
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
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Manage family and sector details associated with resident records.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              { title: "Family Details", description: "Household reference, family members, and relationships.", icon: Users, action: "Manage family details" },
              { title: "Beneficiary Details", description: "Beneficiary information used by approved barangay forms.", icon: UserRound, action: "Manage beneficiaries" },
              { title: "Marginalized-Sector Details", description: "Sector classifications associated with resident records.", icon: FileUp, action: "Manage sector details" },
            ].map((item) => (
              <article key={item.title} className="flex min-h-36 flex-col rounded-xl border bg-background p-4 transition-colors hover:border-primary/40">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary"><item.icon className="size-4" aria-hidden="true" /></span>
                  <h3 className="font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                <button type="button" onClick={() => setNotice(`${item.action} screen selected.`)} className="mt-4 inline-flex min-h-11 items-center self-start rounded-md border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {item.action}
                </button>
              </article>
            ))}
          </div>
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
          <p className="mt-4 text-sm text-muted-foreground">Select a masterlist file to begin the import process.</p>
        </section>
      )}

      <Dialog open={Boolean(selectedResident)} onOpenChange={(open) => { if (!open) setSelectedResident(null) }}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Resident Profile</DialogTitle>
            <DialogDescription>Review resident details, family and sector information, ID records, and issuance history.</DialogDescription>
          </DialogHeader>
          {selectedResident ? <>
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-6" /></span>
              <div className="min-w-0 flex-1"><p className="text-lg font-semibold">{selectedResident.name}</p><p className="text-sm text-muted-foreground">{selectedResident.id} · {selectedResident.address}</p></div>
              <span className="inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-medium">{selectedResident.status}</span>
            </div>
            <div className="flex flex-wrap gap-2 border-b pb-3" role="tablist" aria-label="Resident profile sections">
              {["Details", "Family & Sector", "Barangay ID", "Issuance History"].map((tab) => <button key={tab} type="button" role="tab" aria-selected={profileTab === tab} onClick={() => setProfileTab(tab)} className={profileTab === tab ? "min-h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" : "min-h-11 rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"}>{tab}</button>)}
            </div>
            {profileTab === "Details" ? <div className="grid gap-3 sm:grid-cols-2">{[["Resident reference", selectedResident.id], ["Full name", selectedResident.name], ["Complete address", selectedResident.address], ["Resident type", selectedResident.residentType], ["Registration", selectedResident.registration], ["Record status", selectedResident.status]].map(([label, value]) => <div key={label} className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div> : null}
            {profileTab === "Family & Sector" ? <div className="grid gap-3 sm:grid-cols-2"><section className="rounded-xl border p-4"><Users className="size-5 text-primary" /><h3 className="mt-2 font-semibold">Family details</h3><p className="mt-1 text-sm text-muted-foreground">Household reference, family members, and relationships.</p></section><section className="rounded-xl border p-4"><UserRound className="size-5 text-primary" /><h3 className="mt-2 font-semibold">Beneficiary and sector details</h3><p className="mt-1 text-sm text-muted-foreground">Beneficiary information and sector classifications.</p></section></div> : null}
            {profileTab === "Barangay ID" ? <div className="grid gap-3 sm:grid-cols-2"><section className="rounded-xl border p-4"><CreditCard className="size-5 text-primary" /><p className="mt-2 text-sm text-muted-foreground">Barangay ID number</p><p className="mt-1 font-semibold">{selectedResident.idNumber}</p></section><section className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Registration status</p><p className="mt-1 font-semibold">{selectedResident.registration}</p></section></div> : null}
            {profileTab === "Issuance History" ? <section className="rounded-xl border p-5"><FileCheck2 className="size-6 text-primary" /><h3 className="mt-2 font-semibold">Issuance history</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Documents associated with this resident will appear here when the issuance records are connected.</p></section> : null}
          </> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
