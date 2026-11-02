import { createFileRoute } from "@tanstack/react-router"
import { Archive, CheckCircle2, CreditCard, FileUp, Search, Upload, UserRound, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { RowActions } from "@/components/Common/RowActions"
import { StatCard } from "@/components/Common/StatCard"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResidentProfileDialog } from "@/components/Records/ResidentProfileDialog"
import {
  type ResidentRecord,
  sampleResidents,
} from "@/components/Records/records-sample-data"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/records")({
  component: RecordsManagement,
  head: () => ({ meta: [{ title: pageTitle("Resident Records") }] }),
})

type View = "residents" | "family-sector" | "import"

const inputClass = formControlClass

function RecordsManagement() {
  const [view, setView] = useState<View>("residents")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"Active" | "Archived" | "all">("Active")
  const [residentTypeFilter, setResidentTypeFilter] = useState("all")
  const [residents, setResidents] = useState(sampleResidents)
  const [archiveTarget, setArchiveTarget] = useState<ResidentRecord | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<ResidentRecord | null>(null)
  const [notice, setNotice] = useState("")
  const [selectedFile, setSelectedFile] = useState("")
  const [importStep, setImportStep] = useState(0)
  const [selectedResident, setSelectedResident] =
    useState<ResidentRecord | null>(null)
  const [profileTab, setProfileTab] = useState("Details")
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)

  const filteredResidents = useMemo(
    () =>
      residents
        .filter((resident) => {
          const query = search.trim().toLowerCase()
          const matchesSearch = [resident.name, resident.address, resident.idNumber].some((value) =>
            value.toLowerCase().includes(query),
          )
          return matchesSearch &&
            (statusFilter === "all" || resident.status === statusFilter) &&
            (residentTypeFilter === "all" || resident.residentType === residentTypeFilter)
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [residents, residentTypeFilter, search, statusFilter],
  )

  const tabs: { id: View; label: string }[] = [
    { id: "residents", label: "Residents" },
    { id: "family-sector", label: "Family & Sector Details" },
    ...(isAdmin ? [{ id: "import" as const, label: "Import Masterlist" }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Resident Records
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Search and maintain resident information, related family and sector
            details, and existing Barangay ID references.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setNotice("Resident record form opened.")}>
          <UserRound aria-hidden="true" />
          Add Resident
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b pb-3"
        role="tablist"
        aria-label="Resident record views"
      >
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            role="tab"
            variant={view === tab.id ? "default" : "ghost"}
            aria-selected={view === tab.id}
            onClick={() => {
              setView(tab.id)
              setNotice("")
            }}
            className="min-h-11 rounded-md px-3"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="icon" className="size-11" onClick={() => setNotice("")} aria-label="Dismiss message">
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {view === "residents" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Users} label="Resident Records" value="4" description="Resident records in this view" />
            <StatCard icon={CreditCard} label="ID and Registration Details" value="Included" description="Resident registration and ID details" />
            <StatCard icon={Archive} label="Record Removal" value="Archive" description="Prefer inactive status over permanent deletion" />
          </div>

          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
              <div>
                <h2 className="font-semibold tracking-tight">Resident List</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Find a resident, confirm identity, and choose the next action.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block min-w-0 flex-1 sm:max-w-sm">
                  <span className="sr-only">Search resident records</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, address, or ID number..."
                    className={`${inputClass} pl-9`}
                  />
                </label>
                <label className="sm:w-44">
                  <span className="sr-only">Filter by record status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "Active" | "Archived" | "all")} className={inputClass}>
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                    <option value="all">All statuses</option>
                  </select>
                </label>
                <label className="sm:w-56">
                  <span className="sr-only">Filter by resident type</span>
                  <select value={residentTypeFilter} onChange={(event) => setResidentTypeFilter(event.target.value)} className={inputClass}>
                    <option value="all">All resident types</option>
                    {[...new Set(residents.map((resident) => resident.residentType))].map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Resident", "Birthdate / Age", "Address", "Barangay ID", "Resident type", "Status", "Actions"].map((label) => (
                      <th key={label} className={`px-4 py-3 align-middle font-medium sm:px-5 ${label === "Actions" ? "text-right" : ""}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredResidents.map((resident) => {
                    const birthdate = new Date(`${resident.birthdate}T00:00:00`)
                    const formattedBirthdate = birthdate.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                    const today = new Date()
                    let age = today.getFullYear() - birthdate.getFullYear()
                    if (today.getMonth() < birthdate.getMonth() || (today.getMonth() === birthdate.getMonth() && today.getDate() < birthdate.getDate())) age -= 1
                    const archived = resident.status === "Archived"
                    return (
                      <tr key={resident.id} className={cn("transition-colors hover:bg-muted/30", archived && "opacity-70")}>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <p className="font-semibold">{resident.name}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{resident.id}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">{formattedBirthdate} · {age} yrs</td>
                        <td className="max-w-[220px] truncate px-4 py-3 align-middle sm:px-5" title={resident.address}>{resident.address}</td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <div className="flex flex-col items-start gap-1.5">
                            <span className="font-mono">{resident.idNumber}</span>
                            <Badge variant="outline" className={statusStyles[resident.idStatus]}>{resident.idStatus}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">{resident.residentType}</td>
                        <td className="px-4 py-3 align-middle sm:px-5"><Badge variant="outline" className={statusStyles[resident.status]}>{resident.status}</Badge></td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <RowActions
                            name={resident.name}
                            isAdmin={isAdmin}
                            primary={{
                              label: "View profile",
                              variant: "outline",
                              onSelect: () => {
                                setSelectedResident(resident)
                                setProfileTab("Details")
                              },
                            }}
                            items={[
                              {
                                label: "Edit details",
                                hidden: archived,
                                onSelect: () => {
                                  setSelectedResident(resident)
                                  setProfileTab("Details")
                                  setNotice("Editing is not connected to saved resident records yet.")
                                },
                              },
                              {
                                label: "New issuance",
                                hidden: archived,
                                onSelect: () => setNotice(`Open Issuance Management to prepare a document for ${resident.name}.`),
                              },
                              {
                                label: "Archive",
                                adminOnly: true,
                                hidden: archived,
                                destructive: true,
                                onSelect: () => setArchiveTarget(resident),
                              },
                              {
                                label: "Restore from archive",
                                adminOnly: true,
                                hidden: !archived,
                                onSelect: () => setRestoreTarget(resident),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredResidents.length === 0 ? <EmptyState title="No matching residents" description="Try a different name, address, ID number, or filter." /> : null}
            </div>
            <div className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
              Showing {filteredResidents.length} of {residents.length} residents
            </div>
          </section>
        </>
      )}

      {view === "family-sector" && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Users className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 className="font-semibold tracking-tight">
                Family, Beneficiary, and Marginalized-Sector Details
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Manage family and sector details associated with resident
                records.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Family Details",
                description:
                  "Household reference, family members, and relationships.",
                icon: Users,
                action: "Manage family details",
              },
              {
                title: "Beneficiary Details",
                description:
                  "Beneficiary information used by approved barangay forms.",
                icon: UserRound,
                action: "Manage beneficiaries",
              },
              {
                title: "Marginalized-Sector Details",
                description:
                  "Sector classifications associated with resident records.",
                icon: FileUp,
                action: "Manage sector details",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="flex min-h-36 flex-col rounded-xl border bg-background p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 min-h-11 self-start"
                  onClick={() => setNotice(`${item.action} screen selected.`)}
                >
                  {item.action}
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === "import" && isAdmin && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileUp className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 className="font-semibold">Import Existing Masterlist</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Prepare a controlled import from client-provided spreadsheets.
                Validate the file and preview changes before anything is saved.
              </p>
            </div>
          </div>
          <fieldset
            className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label="Masterlist import steps"
          >
            {["Select file", "Map columns", "Preview", "Results"].map(
              (label, index) => (
                <Button
                  key={label}
                  type="button"
                  variant={importStep === index ? "default" : "outline"}
                  className="min-h-11"
                  aria-current={importStep === index ? "step" : undefined}
                  onClick={() => setImportStep(index)}
                >
                  {index + 1}. {label}
                </Button>
              ),
            )}
          </fieldset>
          {importStep === 0 ? (
            <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:border-primary/50 hover:bg-muted/30">
              <Upload className="size-7 text-primary" aria-hidden="true" />
              <span className="font-semibold">
                {selectedFile || "Choose a masterlist file"}
              </span>
              <span className="text-sm text-muted-foreground">
                Supported formats: CSV, XLSX, XLS
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0]?.name ?? "")
                  setNotice("")
                }}
              />
            </label>
          ) : null}
          {importStep === 1 ? (
            <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
              <h3 className="font-semibold">Map spreadsheet columns</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Match each resident field to a column in the selected
                masterlist.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Full name",
                  "Complete address",
                  "Resident type",
                  "Barangay ID number",
                ].map((field) => (
                  <label
                    key={field}
                    className="flex flex-col gap-2 text-sm font-medium"
                  >
                    {field}
                    <select className={cn(inputClass, "font-normal")}>
                      <option>Choose source column</option>
                      <option>Name</option>
                      <option>Address</option>
                      <option>Resident Type</option>
                      <option>ID Number</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {importStep === 2 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <div className="border-b p-4">
                <h3 className="font-semibold">Preview before import</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review the mapped fields and validation summary before
                  confirming.
                </p>
              </div>
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Field", "Source column", "Validation"].map((label) => (
                      <th key={label} className="px-4 py-3 align-middle font-medium sm:px-5">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Full name", "Name", "Required"],
                    ["Complete address", "Address", "Review format"],
                    ["Resident type", "Resident Type", "Check allowed values"],
                    ["Barangay ID number", "ID Number", "Check duplicates"],
                  ].map((row) => (
                    <tr key={row[0]} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 align-middle font-medium sm:px-5">{row[0]}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">{row[1]}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row[2]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {importStep === 3 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Imported", "Pending"],
                ["Updated", "Pending"],
                ["Skipped", "Pending"],
                ["Failed", "Pending"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-between gap-3 border-t pt-4">
            <Button className="min-h-11" type="button" variant="outline" disabled={importStep === 0} onClick={() => setImportStep((step) => Math.max(0, step - 1))}>Previous step</Button>
            <Button className="min-h-11" type="button" disabled={importStep === 3 || (importStep === 0 && !selectedFile)} onClick={() => setImportStep((step) => Math.min(3, step + 1))}>{importStep === 2 ? "Review results" : "Continue"}</Button>
          </div>
        </section>
      )}

      <ResidentProfileDialog
        resident={selectedResident}
        onOpenChange={(open) => {
          if (!open) setSelectedResident(null)
        }}
        profileTab={profileTab}
        onProfileTabChange={setProfileTab}
      />
    </div>
  )
}
