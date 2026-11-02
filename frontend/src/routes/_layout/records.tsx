import { createFileRoute } from "@tanstack/react-router"
import { Archive, CheckCircle2, CreditCard, FileUp, Search, Upload, UserRound, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/Common/FeedbackState"
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

export const Route = createFileRoute("/_layout/records")({
  component: RecordsManagement,
  head: () => ({ meta: [{ title: pageTitle("Resident Records") }] }),
})

type View = "residents" | "family-sector" | "import"

const inputClass = formControlClass

function RecordsManagement() {
  const [view, setView] = useState<View>("residents")
  const [search, setSearch] = useState("")
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
      sampleResidents.filter((resident) =>
        [
          resident.id,
          resident.name,
          resident.address,
          resident.residentType,
          resident.idNumber,
          resident.registration,
          resident.status,
        ].some((value) => value.toLowerCase().includes(search.toLowerCase())),
      ),
    [search],
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
        <Button onClick={() => setNotice("Resident record form opened.")}>
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
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => {
              setView(tab.id)
              setNotice("")
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${view === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          {notice}
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
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h2 className="font-semibold tracking-tight">Resident List</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Resident records
                </p>
              </div>
              <label className="relative block w-full sm:max-w-sm">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, address, ID, or status..."
                  className={`${inputClass} pl-9`}
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      "Resident Reference",
                      "Resident Name",
                      "Address",
                      "Resident Type",
                      "ID Reference",
                      "Registration",
                      "Record Status",
                      "Action",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 align-middle font-medium sm:px-5">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredResidents.map((resident) => (
                    <tr key={resident.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{resident.id}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">{resident.name}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">{resident.address}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">{resident.residentType}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">{resident.idNumber}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">{resident.registration}</td>
                      <td className="px-4 py-3 align-middle sm:px-5">
                        <Badge variant="outline" className={statusStyles[resident.status]}>{resident.status}</Badge>
                      </td>
                      <td className="px-4 py-3 align-middle sm:px-5">
                        <Button
                          variant="link"
                          className="min-h-11 px-0 font-semibold"
                          onClick={() => {
                            setSelectedResident(resident)
                            setProfileTab("Details")
                          }}
                        >
                          View profile
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResidents.length === 0 && (
                <EmptyState
                  title="No matching residents"
                  description="Try a different name, address, ID, or status."
                />
              )}
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
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <item.icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 self-start"
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
        <section className="rounded-xl border bg-card p-5 shadow-sm">
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
                <button
                  key={label}
                  type="button"
                  onClick={() => setImportStep(index)}
                  aria-current={importStep === index ? "step" : undefined}
                  className={
                    importStep === index
                      ? "min-h-11 rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground"
                      : "min-h-11 rounded-lg border bg-background px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
                  }
                >
                  {index + 1}. {label}
                </button>
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
            <div className="mt-4 rounded-xl border p-4">
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
                      <th key={label} className="px-4 py-3 font-medium">
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
                      <td className="px-4 py-3 font-medium">{row[0]}</td>
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
                <div key={label} className="rounded-xl border bg-card p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-between gap-3 border-t pt-4">
            <button
              type="button"
              disabled={importStep === 0}
              onClick={() => setImportStep((step) => Math.max(0, step - 1))}
              className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold disabled:opacity-40"
            >
              Previous step
            </button>
            <button
              type="button"
              disabled={importStep === 3 || (importStep === 0 && !selectedFile)}
              onClick={() => setImportStep((step) => Math.min(3, step + 1))}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {importStep === 2 ? "Review results" : "Continue"}
            </button>
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
