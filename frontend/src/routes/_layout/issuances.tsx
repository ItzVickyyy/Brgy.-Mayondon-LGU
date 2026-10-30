import { createFileRoute } from "@tanstack/react-router"
import { FileCheck2, Printer, Search, Plus, Eye } from "lucide-react"
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
  status: "Issued" | "Sample" | "Draft"
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
  "Barangay ID",
  "Barangay Clearance",
  "Franchise Clearance",
  "Barangay Clearance (Electrical and Water Connection)",
  "Certificate of Indigency",
  "First-Time Jobseekers Certification",
  "Assistance Request Certification",
  "Damayan",
]

const documentFields: Record<string, DocumentField[]> = {
  "Barangay ID": [
    { name: "idAction", label: "ID Transaction", type: "select", options: ["New ID", "Renewal", "Replacement"] },
    { name: "name", label: "Full Name" },
    { name: "address", label: "Complete Address", fullWidth: true },
    { name: "date", label: "Date Issued", type: "date", defaultToday: true },
    { name: "idNumber", label: "Barangay ID Number" },
    { name: "validUntil", label: "Valid Until", type: "date" },
    { name: "residentType", label: "Resident Type", type: "select", options: ["Existing resident", "New / renting resident"] },
    { name: "remarks", label: "Remarks", type: "textarea", fullWidth: true },
  ],

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
  "Franchise Clearance": [
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
    { name: "addressedTo", label: "Addressed to the Office of", fullWidth: true },
  ],
  "Residency Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "residencyStartDate", label: "Residency Start Date", type: "date" },
    { name: "residencyDuration", label: "Residency Duration" },
    { name: "purpose", label: "Purpose", fullWidth: true },
    { name: "certificationText", label: "Certification Text", type: "textarea", fullWidth: true },
  ],
  "First-Time Jobseekers Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "packetParts", label: "Packet Parts Requested", type: "checkboxes", options: ["Applicant Information Sheet", "Oath of Undertaking", "Barangay Certification"], fullWidth: true },
    { name: "name", label: "Applicant Name" },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "age", label: "Age" },
    { name: "address", label: "Complete Address", fullWidth: true },
    { name: "residencyDuration", label: "Years/Months of Residency" },
    { name: "sexGender", label: "Sex/Gender (use approved field label)" },
    { name: "civilStatus", label: "Civil Status", type: "select", options: civilStatusOptions },
    { name: "educationalAttainment", label: "Educational Attainment" },
    { name: "course", label: "Course (if applicable)" },
    { name: "jobStartBeneficiary", label: "JobStart Beneficiary", type: "select", options: ["Yes", "No"] },
    { name: "witnessName", label: "Oath Witness" },
  ],
  "Assistance Request Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name (Mr./Ms.)" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "residencyDuration", label: "Years of Residency" },
    { name: "sector", label: "Sector" },
    { name: "assistanceType", label: "Assistance Type", type: "select", options: ["Financial", "Medical", "Burial"] },
    { name: "recipientChoice", label: "Recipient", type: "select", options: ["Self", "Relationship / Other Recipient"] },
    { name: "recipientRelationship", label: "Relationship (if applicable)" },
    { name: "underName", label: "Under the Name of" },
    { name: "kagawadSignatoryNote", label: "Signatory Note", fullWidth: true },
  ],
}

const sampleIssuances: IssuanceRecord[] = [
  { id: "ISS-001", resident: "Resident One", type: "Barangay Clearance", date: "2026-10-23", status: "Issued", fields: {} },
  { id: "ISS-002", resident: "Resident Two", type: "Barangay Franchise Clearance", date: "2026-10-22", status: "Issued", fields: {} },
  { id: "ISS-003", resident: "Resident Three", type: "Barangay Clearance (Electrical and Water Connection)", date: "2026-10-22", status: "Issued", fields: {} },
  { id: "ISS-004", resident: "Resident Four", type: "Certificate of Indigency", date: "2026-10-21", status: "Issued", fields: {} },
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

function calculateAge(birthdate: string) {
  if (!birthdate) return ""
  const birth = new Date(birthdate + "T00:00:00")
  if (Number.isNaN(birth.getTime())) return ""
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const birthdayHasNotOccurred =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (birthdayHasNotOccurred) age -= 1
  return age >= 0 ? String(age) : ""
}

function formatDate(value: string) {
  if (!value) return "Not entered"
  const parsed = new Date(value + "T00:00:00")
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function IssuancesManagement() {
  const [isIssuanceModalOpen, setIsIssuanceModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState(documentTypes[0])
  const [search, setSearch] = useState("")
  const [historyType, setHistoryType] = useState("All document types")
  const [formValues, setFormValues] = useState<Record<string, string>>(() => createDefaultFormValues(documentTypes[0]))
  const [drafts, setDrafts] = useState<IssuanceRecord[]>([])
  const [printRecord, setPrintRecord] = useState<IssuanceRecord | null>(null)
  const [notice, setNotice] = useState("")

  const fields = documentFields[selectedType] ?? []
  const currentName = formValues.name?.trim() || "Name not entered"
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
    setFormValues((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "birthdate" ? { age: calculateAge(value) } : {}),
    }))
    setNotice("")
  }

  function changeDocumentType(value: string) {
    setSelectedType(value)
    setFormValues((previous) => ({ ...createDefaultFormValues(value), ...previous }))
    setNotice("")
    setPrintRecord(null)
  }

  function clearForm() {
    setFormValues(createDefaultFormValues(selectedType))
    setNotice("")
    setPrintRecord(null)
  }

  function saveIssuance() {
    if (!formValues.name?.trim()) {
      setNotice("Enter the resident's name before saving the issuance.")
      return
    }
    const record: IssuanceRecord = {
      id: "ISS-" + String(drafts.length + 1).padStart(4, "0"),
      resident: currentName,
      type: selectedType,
      date: currentDate,
      status: "Issued",
      fields: { ...formValues },
    }
    setDrafts((previous) => [record, ...previous])
    setNotice(record.id + " was recorded as issued. You can now print the record.")
    setIsIssuanceModalOpen(false)
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
    setNotice("")
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{"@media print { body * { visibility: hidden !important; } #issuance-print, #issuance-print * { visibility: visible !important; } #issuance-print { display: block !important; position: fixed; inset: 0; width: 100%; padding: 24px; color: #111 !important; background: white !important; } }"}</style>
      <div className="print:hidden flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Admin Portal</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Issuance Management</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Manage Barangay IDs and document issuances, print records, and review issuance history.</p>
        </div>
        <button type="button" onClick={() => setIsIssuanceModalOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="size-4" aria-hidden="true" />New Issuance</button>
      </div>

      {notice && <div role="status" className="print:hidden rounded-lg border bg-muted/40 px-4 py-3 text-sm">{notice}</div>}

      {isIssuanceModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-6" >
          <section role="dialog" aria-modal="true" aria-labelledby="new-issuance-title" className="my-3 w-full max-w-5xl rounded-2xl border bg-card shadow-2xl sm:my-6">\n          <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto p-4 sm:p-6">
          <div className="mb-6 flex items-start gap-3 border-b pb-5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Plus className="size-5" aria-hidden="true" /></div>
            <div className="min-w-0 flex-1"><h2 id="new-issuance-title" className="font-semibold">New Issuance</h2><p className="mt-1 text-sm text-muted-foreground">Choose an issuance type, then fill in the details below.</p></div><button type="button" onClick={() => setIsIssuanceModalOpen(false)} aria-label="Close new issuance form" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">Close</button>
          </div>
              <form onSubmit={(event) => event.preventDefault()} className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName + " md:col-span-2 rounded-xl border bg-muted/20 p-4"}>Issuance Type
              <select value={selectedType} onChange={(event) => changeDocumentType(event.target.value)} className={inputClassName + " bg-background"}>
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
                  <input type={field.type ?? "text"} value={formValues[field.name] ?? ""} onChange={(event) => updateField(field.name, event.target.value)} readOnly={field.name === "age"} className={inputClassName + (field.name === "age" ? " bg-muted/50" : "")} placeholder={field.name === "age" ? "Calculated from birthdate" : field.type === "date" ? undefined : "Enter " + field.label.toLowerCase()} />
                )}
              </div>
            ))}

            <div className="md:col-span-2 rounded-xl border bg-muted/30 p-4 text-sm">
              <p className="font-semibold">Issuance Summary</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Issuance Type</p><p className="mt-1 font-medium">{selectedType}</p></div>
                <div><p className="text-xs text-muted-foreground">Resident Name</p><p className="mt-1 font-medium">{currentName}</p></div>
                <div><p className="text-xs text-muted-foreground">Date</p><p className="mt-1 font-medium">{formatDate(currentDate)}</p></div>
              </div>
            </div>
            <div className="sticky bottom-0 md:col-span-2 -mx-1 flex flex-wrap justify-end gap-2 border-t bg-card/95 px-1 pb-1 pt-4 backdrop-blur-sm">
              <button type="button" onClick={clearForm} className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted">Clear Form</button>
              <button type="button" onClick={saveIssuance} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"><FileCheck2 className="size-4" aria-hidden="true" />Save as Issued</button>
              <button type="button" onClick={() => { preparePrint(); window.setTimeout(() => window.print(), 100) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"><Printer className="size-4" aria-hidden="true" />Print Preview</button>
              <button type="button" onClick={() => setIsIssuanceModalOpen(false)} className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
            </div>
          </form>
          </div>
          </section>
        </div>
      )}

      <section className="print:hidden overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="font-semibold">Issuance History</h2><p className="mt-1 text-sm text-muted-foreground">Search and review previous Barangay ID and document issuances.</p></div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
              <label className="relative block min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference number, resident, type, or date..." className={inputClassName + " pl-9"} /></label>
              <select value={historyType} onChange={(event) => setHistoryType(event.target.value)} className={inputClassName + " sm:max-w-[260px]"}>
                <option>All document types</option>
                {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Record ID</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Issuance Type</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
              <tbody className="divide-y">
                {filteredIssuances.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{item.id}</td>
                    <td className="px-4 py-3">{item.resident}</td>
                    <td className="px-4 py-3">{item.type}</td>
                    <td className="px-4 py-3">{formatDate(item.date)}</td>
                    <td className="px-4 py-3"><span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (item.status === "Draft" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : item.status === "Issued" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{item.status}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => { preparePrint(item); setNotice("Print preview prepared for " + item.id + ".") }} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"><Eye className="size-3.5" aria-hidden="true" />View</button><button type="button" onClick={() => { preparePrint(item); window.setTimeout(() => window.print(), 100) }} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"><Printer className="size-3.5" aria-hidden="true" />Print</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredIssuances.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No records match your search and filter.</p>}
          </div>
      </section>

      <section id="issuance-print" className="hidden print:block p-6 text-black">
        <p className="text-sm">Selected document: {printRecord?.type ?? selectedType}</p>
        <p className="text-sm"></p>
      </section>
    </div>
  )
}
