import { createFileRoute } from "@tanstack/react-router"
import { FileCheck2, Printer, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/issuances")({
  component: IssuancesManagement,
  head: () => ({ meta: [{ title: pageTitle("Issuances Management") }] }),
})

type FieldType = "text" | "date" | "textarea" | "checkboxes" | "select"
type DocumentField = {
  name: string
  label: string
  type?: FieldType
  options?: string[]
  defaultToday?: boolean
  fullWidth?: boolean
}
type IssuanceRecord = {
  id: string
  resident: string
  type: string
  date: string
  status: "Sample" | "Draft"
  fields: Record<string, string>
}

const civilStatusOptions = ["Single", "Married", "Legally Seperated", "Widow/Widower"]
const idTypeOptions = ["CTC", "VIN", "PASSPORT", "UMID", "TIN", "DRIVER LICENSE", "SENIOR CITIZEN", "SOLO PARENT", "POSTAL ID", "PhilHealth", "PRC ID", "Nat'l ID", "SSS ID", "SCHOOL ID"]
const clearancePurposeOptions = [
  "Employment Requirement", "Student Permit Requirement", "Proof of Residency only",
  "SIDECAR Loan Application Requirement", "Loan Application Requirement",
  "House Loan Application Requirement", "Franchise Requirement",
  "Internet Connection Application Requirement", "Bank Requirement (Openning Bank Account)",
  "Driver's License Requirement", "Overseas Employment Requirement",
  "E-BIKE Loan Application Requirement", "Permit to Carry Firearms License",
  "E-BIKE Franchise Requirement", "Employment Requirement/First Time Jobseeker",
  "School/OJT Requirement", "Motor Loan Application Requirement",
  "Electric Installation Requirements", "Senior Citizen Requirement",
  "Application for Service/Special Permit",
]
const indigencySectorOptions = [
  "Urban Poor", "Small Farmers and Rural Workers", "Fisherfolk", "Workers in the Informal Economy",
  "Person with Disabilities (PWD)", "Solo Parents", "Senior Citizens", "Barangay-based Volunteer Workers",
  "Government Employee", "STUDENT", "other marginalized sector",
]
const documentTypes = [
  "Barangay Clearance",
  "Barangay Franchise Clearance",
  "Barangay Clearance (Electrical and Water Connection)",
  "Certificate of Indigency",
]

const documentFields: Record<string, DocumentField[]> = {
  "Barangay Clearance": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "age", label: "Age" },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "birthplace", label: "Birthplace" },
    { name: "civilStatus", label: "Civil Status", type: "select", options: civilStatusOptions },
    { name: "purpose", label: "Purpose", type: "select", options: clearancePurposeOptions, fullWidth: true },
    { name: "remarks", label: "Remarks", type: "textarea", fullWidth: true },
    { name: "validIdPresented", label: "Valid ID Presented", type: "select", options: idTypeOptions },
    { name: "idNumber", label: "Number" },
    { name: "idPlaceOfIssue", label: "Place of Issue" },
    { name: "idDateOfIssue", label: "Date of Issue", type: "date", defaultToday: true },
    { name: "officialReceiptNumber", label: "Paid under Official Receipt Number" },
  ],
  "Barangay Franchise Clearance": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "tricycleAssociation", label: "Tricycle Association", fullWidth: true },
    { name: "make", label: "Make" },
    { name: "typeOfBody", label: "Type of Body" },
    { name: "motorNumber", label: "Motor Number" },
    { name: "color", label: "Color" },
    { name: "plateNumber", label: "Plate Number" },
    { name: "ctcNumber", label: "CTC Number" },
    { name: "ctcPlaceOfIssue", label: "Place of Issue" },
    { name: "ctcDateOfIssue", label: "Date of Issue", type: "date", defaultToday: true },
    { name: "officialReceiptNumber", label: "Paid under Official Receipt Number" },
  ],
  "Barangay Clearance (Electrical and Water Connection)": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "serviceType", label: "Connection Service", type: "checkboxes", options: ["Electric", "Water"], fullWidth: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "connectionType", label: "Type of Connection", type: "checkboxes", options: ["New", "Reconnection"], fullWidth: true },
    { name: "classification", label: "Classification", type: "checkboxes", options: ["Residential", "Commercial"], fullWidth: true },
    { name: "location", label: "Location", fullWidth: true },
    { name: "ctcNumber", label: "CTC Number" },
    { name: "ctcPlaceOfIssue", label: "Place of Issue" },
    { name: "ctcDateOfIssue", label: "Date of Issue", type: "date", defaultToday: true },
    { name: "officialReceiptNumber", label: "Paid under Official Receipt Number" },
  ],
  "Certificate of Indigency": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "age", label: "Age" },
    { name: "sector", label: "Sector", type: "select", options: indigencySectorOptions },
    { name: "purpose", label: "Purpose", type: "textarea", fullWidth: true },
  ],
}

const sampleResidents = [
  { id: "SAMPLE-0001", name: "Sample Resident One", address: "Sample Address One" },
  { id: "SAMPLE-0002", name: "Sample Resident Two", address: "Sample Address Two" },
  { id: "SAMPLE-0003", name: "Sample Resident Three", address: "Sample Address Three" },
  { id: "SAMPLE-0004", name: "Sample Resident Four", address: "Sample Address Four" },
]

const sampleIssuances: IssuanceRecord[] = [
  { id: "SAMPLE-001", resident: "Sample Resident One", type: "Barangay Clearance", date: "2026-10-23", status: "Sample", fields: {} },
  { id: "SAMPLE-002", resident: "Sample Resident Two", type: "Barangay Franchise Clearance", date: "2026-10-22", status: "Sample", fields: {} },
  { id: "SAMPLE-003", resident: "Sample Resident Three", type: "Barangay Clearance (Electrical and Water Connection)", date: "2026-10-22", status: "Sample", fields: {} },
  { id: "SAMPLE-004", resident: "Sample Resident Four", type: "Certificate of Indigency", date: "2026-10-21", status: "Sample", fields: {} },
]

const inputClassName = "h-10 w-full rounded-md border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
const labelClassName = "flex min-w-0 flex-col gap-2 text-sm font-medium"

function localDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function createDefaultFormValues(type: string) {
  const today = localDateValue()
  return Object.fromEntries((documentFields[type] ?? []).filter((field) => field.defaultToday).map((field) => [field.name, today])) as Record<string, string>
}

function formatDate(value: string) {
  if (!value) return "Not entered"
  const parsed = new Date(value + "T00:00:00")
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function IssuancesManagement() {
  const [activeTab, setActiveTab] = useState<"issue" | "history">("issue")
  const [selectedType, setSelectedType] = useState(documentTypes[0])
  const [selectedResidentId, setSelectedResidentId] = useState("")
  const [search, setSearch] = useState("")
  const [historyType, setHistoryType] = useState("All document types")
  const [formValues, setFormValues] = useState<Record<string, string>>(() => createDefaultFormValues(documentTypes[0]))
  const [drafts, setDrafts] = useState<IssuanceRecord[]>([])
  const [printRecord, setPrintRecord] = useState<IssuanceRecord | null>(null)
  const [notice, setNotice] = useState("")

  const fields = documentFields[selectedType] ?? []
  const selectedResident = sampleResidents.find((resident) => resident.id === selectedResidentId)
  const currentName = formValues.name?.trim() || "Select a resident first"
  const currentDate = formValues.date || ""
  const allRecords = useMemo(() => [...drafts, ...sampleIssuances], [drafts])
  const filteredIssuances = useMemo(() => allRecords.filter((item) => {
    const matchesSearch = [item.id, item.resident, item.type, item.date, item.status].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    )
    const matchesType = historyType === "All document types" || item.type === historyType
    return matchesSearch && matchesType
  }), [allRecords, historyType, search])

  function updateField(name: string, value: string) {
    setFormValues((previous) => ({ ...previous, [name]: value }))
    setNotice("")
  }

  function changeResident(value: string) {
    setSelectedResidentId(value)
    const resident = sampleResidents.find((item) => item.id === value)
    setFormValues((previous) => ({
      ...createDefaultFormValues(selectedType),
      ...(resident ? { name: resident.name, address: resident.address } : {}),
      ...(previous.date ? { date: previous.date } : {}),
    }))
    setNotice("")
    setPrintRecord(null)
  }

  function changeDocumentType(value: string) {
    setSelectedType(value)
    setFormValues({
      ...createDefaultFormValues(value),
      ...(selectedResident ? { name: selectedResident.name, address: selectedResident.address } : {}),
    })
    setNotice("")
    setPrintRecord(null)
  }

  function clearForm() {
    setFormValues({
      ...createDefaultFormValues(selectedType),
      ...(selectedResident ? { name: selectedResident.name, address: selectedResident.address } : {}),
    })
    setNotice("")
    setPrintRecord(null)
  }

  function saveDraft() {
    if (!selectedResident) {
      setNotice("Select a resident before saving a document draft.")
      return
    }
    const record: IssuanceRecord = {
      id: "DRAFT-" + String(drafts.length + 1).padStart(3, "0"),
      resident: currentName,
      type: selectedType,
      date: currentDate,
      status: "Draft",
      fields: { ...formValues },
    }
    setDrafts((previous) => [record, ...previous])
    setNotice(record.id + " was added to this session's draft history. It has not been saved to the database or officially issued.")
    setActiveTab("history")
  }

  function preparePrint(record?: IssuanceRecord) {
    setPrintRecord(record ?? {
      id: "PRINT-PREVIEW",
      resident: currentName,
      type: selectedType,
      date: currentDate,
      status: "Draft",
      fields: { ...formValues },
    })
    window.setTimeout(() => window.print(), 100)
  }

  const printFields = printRecord ? documentFields[printRecord.type] ?? [] : fields
  const printValues = printRecord?.fields ?? formValues

  return (
    <div className="flex flex-col gap-6">
      <style>{"@media print { body * { visibility: hidden !important; } #issuance-print, #issuance-print * { visibility: visible !important; } #issuance-print { display: block !important; position: fixed; inset: 0; width: 100%; padding: 24px; color: #111 !important; background: white !important; } }"}</style>
      <div className="print:hidden">
        <p className="text-sm font-medium text-primary">Admin Portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Issuances Management</h1>
      </div>

      {notice && <div role="status" className="print:hidden rounded-lg border bg-muted/40 px-4 py-3 text-sm">{notice}</div>}

      <div className="print:hidden flex flex-wrap gap-2 border-b">
        <button type="button" onClick={() => setActiveTab("issue")} className={"border-b-2 px-4 py-3 text-sm font-medium " + (activeTab === "issue" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Issue Document</button>
        <button type="button" onClick={() => setActiveTab("history")} className={"border-b-2 px-4 py-3 text-sm font-medium " + (activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Issuance History</button>
      </div>

      {activeTab === "issue" ? (
        <section className="print:hidden rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileCheck2 className="size-5" aria-hidden="true" /></div>
            <div><h2 className="font-semibold">Document Details</h2><p className="mt-1 text-sm text-muted-foreground">Choose a document to show its corresponding hardcopy fields.</p></div>
          </div>
          <form onSubmit={(event) => event.preventDefault()} className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName + " md:col-span-2"}>Resident
              <select required value={selectedResidentId} onChange={(event) => changeResident(event.target.value)} className={inputClassName}>
                <option value="">Select a sample resident first</option>
                {sampleResidents.map((resident) => <option key={resident.id} value={resident.id}>{resident.id} · {resident.name}</option>)}
              </select>
              <span className="text-xs font-normal text-muted-foreground">Sample resident list only. This selector is not connected to Resident Records yet.</span>
            </label>
            <label className={labelClassName + " md:col-span-2"}>Document Type
              <select value={selectedType} onChange={(event) => changeDocumentType(event.target.value)} className={inputClassName}>
                {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>

            {fields.map((field) => (
              <div key={field.name} className={labelClassName + " " + (field.fullWidth || field.type === "textarea" || field.type === "checkboxes" ? "md:col-span-2" : "")}>
                <span>{field.label}</span>
                {field.type === "select" ? (
                  <select value={formValues[field.name] ?? ""} onChange={(event) => updateField(field.name, event.target.value)} className={inputClassName}>
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea value={formValues[field.name] ?? ""} onChange={(event) => updateField(field.name, event.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={"Enter " + field.label.toLowerCase()} />
                ) : field.type === "checkboxes" ? (
                  <div className="flex flex-wrap gap-4 rounded-md border bg-background px-3 py-3">
                    {(field.options ?? []).map((option) => {
                      const checkedValues = (formValues[field.name] ?? "").split("||").filter(Boolean)
                      return (
                        <label key={option} className="inline-flex items-center gap-2 font-normal">
                          <input type="checkbox" checked={checkedValues.includes(option)} onChange={(event) => {
                            const nextValues = event.target.checked ? [...checkedValues, option] : checkedValues.filter((value) => value !== option)
                            updateField(field.name, nextValues.join("||"))
                          }} className="size-4 rounded border-input accent-primary" />
                          {option}
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <input type={field.type ?? "text"} value={formValues[field.name] ?? ""} onChange={(event) => updateField(field.name, event.target.value)} className={inputClassName} placeholder={field.type === "date" ? undefined : "Enter " + field.label.toLowerCase()} />
                )}
              </div>
            ))}

            <div className="md:col-span-2 rounded-lg bg-muted/40 p-4 text-sm">
              <p className="font-medium">Draft summary</p>
              <p className="mt-1 text-muted-foreground">Resident: {selectedResident ? selectedResident.name : "Not selected"}</p>
              <p className="text-muted-foreground">Document: {selectedType}</p>
              <p className="text-muted-foreground">Name: {currentName}</p>
              <p className="text-muted-foreground">Date: {formatDate(currentDate)}</p>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button type="button" onClick={clearForm} className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted">Clear Form</button>
              <button type="button" onClick={saveDraft} className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted">Save Draft to Session</button>
              <button type="button" onClick={() => preparePrint()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"><Printer className="size-4" aria-hidden="true" />Print Review Copy</button>
              <button type="button" onClick={() => setActiveTab("history")} className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted">View History</button>
            </div>
          </form>
        </section>
      ) : (
        <section className="print:hidden overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="font-semibold">Issuance History</h2><p className="mt-1 text-sm text-muted-foreground">Review issuance history and drafts saved during this session.</p></div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
              <label className="relative block min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ID, name, type, or date..." className={inputClassName + " pl-9"} /></label>
              <select value={historyType} onChange={(event) => setHistoryType(event.target.value)} className={inputClassName + " sm:max-w-[260px]"}>
                <option>All document types</option>
                {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Record ID</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Document Type</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
              <tbody className="divide-y">
                {filteredIssuances.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{item.id}</td>
                    <td className="px-4 py-3">{item.resident}</td>
                    <td className="px-4 py-3">{item.type}</td>
                    <td className="px-4 py-3">{formatDate(item.date)}</td>
                    <td className="px-4 py-3"><span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (item.status === "Draft" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{item.status}</span></td>
                    <td className="px-4 py-3">{item.status === "Draft" ? <button type="button" onClick={() => preparePrint(item)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"><Printer className="size-3.5" aria-hidden="true" />Print draft</button> : <span className="text-xs text-muted-foreground">View record</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredIssuances.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No records match your search and filter.</p>}
          </div>
        </section>
      )}

      <section id="issuance-print" className="hidden print:block p-6 text-black">
        <header className="mb-6 border-b border-gray-400 pb-4 text-center">
          <img
            src="/assets/images/Barangay%20Mayondon%20Logo.png"
            alt="Barangay Mayondon LGU logo"
            className="mx-auto mb-3 h-16 w-16 object-contain"
          />
          <p className="text-sm font-medium">Barangay Mayondon LGU</p>
          <p className="text-xs">Los Baños, Laguna</p>
          <h1 className="mt-3 text-xl font-bold">{printRecord?.type ?? selectedType}</h1>
        </header>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {printFields.map((field) => {
            const value = printValues[field.name] ?? ""
            const displayValue = value.split("||").filter(Boolean).join(", ")
            return (
              <div key={field.name} className={field.fullWidth || field.type === "textarea" || field.type === "checkboxes" ? "col-span-2" : ""}>
                <p className="text-xs font-semibold">{field.label}</p>
                <p className="mt-1 min-h-6 whitespace-pre-wrap border-b border-gray-300 pb-1 text-sm">{displayValue || " "}</p>
              </div>
            )
          })}
        </div>
        <footer className="mt-10 border-t border-gray-300 pt-3 text-xs">
          Record: {printRecord?.id ?? "Print preview"}
        </footer>
      </section>
    </div>
  )
}
