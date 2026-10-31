import { createFileRoute } from "@tanstack/react-router"
import {
  CalendarDays,
  CheckCircle2,
  Eraser,
  Eye,
  FileCheck2,
  FileText,
  Inbox,
  Plus,
  Printer,
  Search,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { pageTitle } from "@/config/site"
import { cn } from "@/lib/utils"

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

const civilStatusOptions = [
  "Single",
  "Married",
  "Legally Seperated",
  "Widow/Widower",
]
const idTypeOptions = [
  "CTC",
  "VIN",
  "PASSPORT",
  "UMID",
  "TIN",
  "DRIVER LICENSE",
  "SENIOR CITIZEN",
  "SOLO PARENT",
  "POSTAL ID",
  "PhilHealth",
  "PRC ID",
  "Nat'l ID",
  "SSS ID",
  "SCHOOL ID",
]
const clearancePurposeOptions = [
  "Employment Requirement",
  "Student Permit Requirement",
  "Proof of Residency only",
  "SIDECAR Loan Application Requirement",
  "Loan Application Requirement",
  "House Loan Application Requirement",
  "Franchise Requirement",
  "Internet Connection Application Requirement",
  "Bank Requirement (Openning Bank Account)",
  "Driver's License Requirement",
  "Overseas Employment Requirement",
  "E-BIKE Loan Application Requirement",
  "Permit to Carry Firearms License",
  "E-BIKE Franchise Requirement",
  "Employment Requirement/First Time Jobseeker",
  "School/OJT Requirement",
  "Motor Loan Application Requirement",
  "Electric Installation Requirements",
  "Senior Citizen Requirement",
  "Application for Service/Special Permit",
]
const indigencySectorOptions = [
  "Urban Poor",
  "Small Farmers and Rural Workers",
  "Fisherfolk",
  "Workers in the Informal Economy",
  "Person with Disabilities (PWD)",
  "Solo Parents",
  "Senior Citizens",
  "Barangay-based Volunteer Workers",
  "Government Employee",
  "STUDENT",
  "other marginalized sector",
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
    {
      name: "idAction",
      label: "ID Transaction",
      type: "select",
      options: ["New ID", "Renewal", "Replacement"],
    },
    { name: "name", label: "Full Name" },
    { name: "address", label: "Complete Address", fullWidth: true },
    { name: "date", label: "Date Issued", type: "date", defaultToday: true },
    { name: "idNumber", label: "Barangay ID Number" },
    { name: "validUntil", label: "Valid Until", type: "date" },
    {
      name: "residentType",
      label: "Resident Type",
      type: "select",
      options: ["Existing resident", "New / renting resident"],
    },
    { name: "remarks", label: "Remarks", type: "textarea", fullWidth: true },
  ],

  "Barangay Clearance": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "age", label: "Age" },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "birthplace", label: "Birthplace" },
    {
      name: "civilStatus",
      label: "Civil Status",
      type: "select",
      options: civilStatusOptions,
    },
    {
      name: "purpose",
      label: "Purpose",
      type: "select",
      options: clearancePurposeOptions,
      fullWidth: true,
    },
    { name: "remarks", label: "Remarks", type: "textarea", fullWidth: true },
    {
      name: "validIdPresented",
      label: "Valid ID Presented",
      type: "select",
      options: idTypeOptions,
    },
    { name: "idNumber", label: "Number" },
    { name: "idPlaceOfIssue", label: "Place of Issue" },
    {
      name: "idDateOfIssue",
      label: "Date of Issue",
      type: "date",
      defaultToday: true,
    },
    {
      name: "officialReceiptNumber",
      label: "Paid under Official Receipt Number",
    },
  ],
  "Franchise Clearance": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    {
      name: "tricycleAssociation",
      label: "Tricycle Association",
      fullWidth: true,
    },
    { name: "make", label: "Make" },
    { name: "typeOfBody", label: "Type of Body" },
    { name: "motorNumber", label: "Motor Number" },
    { name: "color", label: "Color" },
    { name: "plateNumber", label: "Plate Number" },
    { name: "ctcNumber", label: "CTC Number" },
    { name: "ctcPlaceOfIssue", label: "Place of Issue" },
    {
      name: "ctcDateOfIssue",
      label: "Date of Issue",
      type: "date",
      defaultToday: true,
    },
    {
      name: "officialReceiptNumber",
      label: "Paid under Official Receipt Number",
    },
  ],
  "Barangay Clearance (Electrical and Water Connection)": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    {
      name: "serviceType",
      label: "Connection Service",
      type: "checkboxes",
      options: ["Electric", "Water"],
      fullWidth: true,
    },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    {
      name: "connectionType",
      label: "Type of Connection",
      type: "checkboxes",
      options: ["New", "Reconnection"],
      fullWidth: true,
    },
    {
      name: "classification",
      label: "Classification",
      type: "checkboxes",
      options: ["Residential", "Commercial"],
      fullWidth: true,
    },
    { name: "location", label: "Location", fullWidth: true },
    { name: "ctcNumber", label: "CTC Number" },
    { name: "ctcPlaceOfIssue", label: "Place of Issue" },
    {
      name: "ctcDateOfIssue",
      label: "Date of Issue",
      type: "date",
      defaultToday: true,
    },
    {
      name: "officialReceiptNumber",
      label: "Paid under Official Receipt Number",
    },
  ],
  "Certificate of Indigency": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "age", label: "Age" },
    {
      name: "sector",
      label: "Sector",
      type: "select",
      options: indigencySectorOptions,
    },
    { name: "purpose", label: "Purpose", type: "textarea", fullWidth: true },
    {
      name: "addressedTo",
      label: "Addressed to the Office of",
      fullWidth: true,
    },
  ],
  "Residency Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "residencyStartDate", label: "Residency Start Date", type: "date" },
    { name: "residencyDuration", label: "Residency Duration" },
    { name: "purpose", label: "Purpose", fullWidth: true },
    {
      name: "certificationText",
      label: "Certification Text",
      type: "textarea",
      fullWidth: true,
    },
  ],
  "First-Time Jobseekers Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    {
      name: "packetParts",
      label: "Packet Parts Requested",
      type: "checkboxes",
      options: [
        "Applicant Information Sheet",
        "Oath of Undertaking",
        "Barangay Certification",
      ],
      fullWidth: true,
    },
    { name: "name", label: "Applicant Name" },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "age", label: "Age" },
    { name: "address", label: "Complete Address", fullWidth: true },
    { name: "residencyDuration", label: "Years/Months of Residency" },
    { name: "sexGender", label: "Sex/Gender (use approved field label)" },
    {
      name: "civilStatus",
      label: "Civil Status",
      type: "select",
      options: civilStatusOptions,
    },
    { name: "educationalAttainment", label: "Educational Attainment" },
    { name: "course", label: "Course (if applicable)" },
    {
      name: "jobStartBeneficiary",
      label: "JobStart Beneficiary",
      type: "select",
      options: ["Yes", "No"],
    },
    { name: "witnessName", label: "Oath Witness" },
  ],
  "Assistance Request Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name (Mr./Ms.)" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "residencyDuration", label: "Years of Residency" },
    { name: "sector", label: "Sector" },
    {
      name: "assistanceType",
      label: "Assistance Type",
      type: "select",
      options: ["Financial", "Medical", "Burial"],
    },
    {
      name: "recipientChoice",
      label: "Recipient",
      type: "select",
      options: ["Self", "Relationship / Other Recipient"],
    },
    { name: "recipientRelationship", label: "Relationship (if applicable)" },
    { name: "underName", label: "Under the Name of" },
    { name: "kagawadSignatoryNote", label: "Signatory Note", fullWidth: true },
  ],
}

const sampleIssuances: IssuanceRecord[] = [
  {
    id: "ISS-001",
    resident: "Resident One",
    type: "Barangay Clearance",
    date: "2026-10-23",
    status: "Issued",
    fields: {},
  },
  {
    id: "ISS-002",
    resident: "Resident Two",
    type: "Franchise Clearance",
    date: "2026-10-22",
    status: "Issued",
    fields: {},
  },
  {
    id: "ISS-003",
    resident: "Resident Three",
    type: "Barangay Clearance (Electrical and Water Connection)",
    date: "2026-10-22",
    status: "Issued",
    fields: {},
  },
  {
    id: "ISS-004",
    resident: "Resident Four",
    type: "Certificate of Indigency",
    date: "2026-10-21",
    status: "Issued",
    fields: {},
  },
]

const inputClassName =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
const labelClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-medium"

const statusStyles: Record<IssuanceRecord["status"], string> = {
  Issued:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  Draft:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  Sample: "border-border bg-muted text-muted-foreground",
}

function localDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function createDefaultFormValues(type: string) {
  const today = localDateValue()
  return Object.fromEntries(
    (documentFields[type] ?? [])
      .filter((field) => field.defaultToday)
      .map((field) => [field.name, today]),
  ) as Record<string, string>
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
    : parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof FileText
  label: string
  value: string | number
  hint: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold leading-tight tracking-tight">
          {value}
        </p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

function IssuancesManagement() {
  const [isIssuanceModalOpen, setIsIssuanceModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState(documentTypes[0])
  const [search, setSearch] = useState("")
  const [historyType, setHistoryType] = useState("All document types")
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    createDefaultFormValues(documentTypes[0]),
  )
  const [drafts, setDrafts] = useState<IssuanceRecord[]>([])
  const [printRecord, setPrintRecord] = useState<IssuanceRecord | null>(null)
  const [viewRecord, setViewRecord] = useState<IssuanceRecord | null>(null)
  const [notice, setNotice] = useState("")

  const fields = documentFields[selectedType] ?? []
  const currentName = formValues.name?.trim() || "Name not entered"
  const currentDate = formValues.date || ""
  const allRecords = useMemo(() => [...drafts, ...sampleIssuances], [drafts])
  const filteredIssuances = useMemo(
    () =>
      allRecords.filter((item) => {
        const matchesSearch = [
          item.id,
          item.resident,
          item.type,
          item.date,
          item.status,
        ].some((value) => value.toLowerCase().includes(search.toLowerCase()))
        const matchesType =
          historyType === "All document types" || item.type === historyType
        return matchesSearch && matchesType
      }),
    [allRecords, historyType, search],
  )

  const issuedCount = allRecords.filter(
    (item) => item.status === "Issued",
  ).length
  const latestDate =
    allRecords
      .map((item) => item.date)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? ""
  const typeCounts = allRecords.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
  const hasFilters =
    search.trim() !== "" || historyType !== "All document types"

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
    setFormValues((previous) => ({
      ...createDefaultFormValues(value),
      ...previous,
    }))
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
    setNotice(
      record.id + " was recorded as issued. You can now print the record.",
    )
    setIsIssuanceModalOpen(false)
  }

  function preparePrint(record?: IssuanceRecord) {
    setPrintRecord(
      record ?? {
        id: "PRINT-PREVIEW",
        resident: currentName,
        type: selectedType,
        date: currentDate,
        status: "Draft",
        fields: { ...formValues },
      },
    )
    setNotice("")
  }

  function printNow(record?: IssuanceRecord) {
    preparePrint(record)
    window.setTimeout(() => window.print(), 100)
  }

  function renderField(field: DocumentField) {
    const wide =
      field.fullWidth ||
      field.type === "textarea" ||
      field.type === "checkboxes"
    const value = formValues[field.name] ?? ""
    const wrapperClass = cn(labelClassName, wide && "md:col-span-2")

    if (field.type === "checkboxes") {
      const checkedValues = value.split("||").filter(Boolean)
      return (
        <fieldset key={field.name} className={wrapperClass}>
          <legend className="mb-1.5 text-sm font-medium">{field.label}</legend>
          <div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((option) => {
              const checked = checkedValues.includes(option)
              return (
                <label
                  key={option}
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-normal transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...checkedValues, option]
                        : checkedValues.filter((item) => item !== option)
                      updateField(field.name, next.join("||"))
                    }}
                    className="size-4 rounded border-input accent-primary"
                  />
                  {option}
                </label>
              )
            })}
          </div>
        </fieldset>
      )
    }

    return (
      <div key={field.name} className={wrapperClass}>
        <label htmlFor={"field-" + field.name}>{field.label}</label>
        {field.type === "select" ? (
          <select
            id={"field-" + field.name}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            className={inputClassName}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            id={"field-" + field.name}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            rows={3}
            className={cn(inputClassName, "h-auto py-2")}
            placeholder={"Enter " + field.label.toLowerCase()}
          />
        ) : (
          <input
            id={"field-" + field.name}
            type={field.type ?? "text"}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            readOnly={field.name === "age"}
            className={cn(
              inputClassName,
              field.name === "age" && "bg-muted/50",
            )}
            placeholder={
              field.name === "age"
                ? "Calculated from birthdate"
                : field.type === "date"
                  ? undefined
                  : "Enter " + field.label.toLowerCase()
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <style>
        {
          "@media print { body * { visibility: hidden !important; } #issuance-print, #issuance-print * { visibility: visible !important; } #issuance-print { display: block !important; position: fixed; inset: 0; width: 100%; padding: 24px; color: #111 !important; background: white !important; } }"
        }
      </style>

      {/* Page header */}
      <header className="print:hidden flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Issuance Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prepare Barangay IDs and certificates, print records, and review
            past issuances.
          </p>
        </div>
        <Button
          size="default"
          className="w-full sm:w-auto"
          onClick={() => setIsIssuanceModalOpen(true)}
        >
          <Plus aria-hidden="true" />
          New Issuance
        </Button>
      </header>

      {notice && (
        <div
          role="status"
          className="print:hidden flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="print:hidden grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={FileCheck2}
          label="Total issued"
          value={issuedCount}
          hint="All recorded issuances"
        />
        <SummaryCard
          icon={CalendarDays}
          label="Latest issuance"
          value={latestDate ? formatDate(latestDate) : "None yet"}
          hint="Most recent record date"
        />
        <SummaryCard
          icon={FileText}
          label="Most issued document"
          value={topType ? topType[1] : 0}
          hint={topType ? topType[0] : "No records yet"}
        />
      </div>

      {/* New issuance dialog */}
      <Dialog open={isIssuanceModalOpen} onOpenChange={setIsIssuanceModalOpen}>
        <DialogContent className="print:hidden flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6">
            <DialogTitle className="text-lg">New Issuance</DialogTitle>
            <DialogDescription>
              Choose a document type, then fill in the details once. Required:
              resident name.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => event.preventDefault()}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-5 py-5 sm:px-6">
              <section className="rounded-xl border bg-card p-4 sm:p-5">
                <label className={labelClassName}>
                  <span className="text-sm font-semibold">Document type</span>
                  <select
                    value={selectedType}
                    onChange={(event) => changeDocumentType(event.target.value)}
                    className={inputClassName}
                  >
                    {documentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <FormSection
                title={selectedType}
                description="Fields marked on the approved form. Date fields default to today."
              >
                {fields.map(renderField)}
              </FormSection>

              <section className="rounded-xl border border-dashed bg-card p-4 text-sm sm:p-5">
                <p className="text-sm font-semibold">Summary</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Document</dt>
                    <dd className="mt-0.5 font-medium">{selectedType}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Resident</dt>
                    <dd className="mt-0.5 font-medium">{currentName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Date</dt>
                    <dd className="mt-0.5 font-medium">
                      {formatDate(currentDate)}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            <DialogFooter className="border-t bg-card px-5 py-3 sm:items-center sm:px-6">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="sm:mr-auto"
                onClick={clearForm}
              >
                <Eraser aria-hidden="true" />
                Clear form
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => printNow()}
              >
                <Printer aria-hidden="true" />
                Print preview
              </Button>
              <Button type="button" size="lg" onClick={saveIssuance}>
                <FileCheck2 aria-hidden="true" />
                Save as issued
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record details dialog */}
      <Dialog
        open={viewRecord !== null}
        onOpenChange={(open) => !open && setViewRecord(null)}
      >
        <DialogContent className="print:hidden sm:max-w-lg">
          {viewRecord && (
            <>
              <DialogHeader>
                <DialogTitle>{viewRecord.id}</DialogTitle>
                <DialogDescription>{viewRecord.type}</DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Resident</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.resident}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Date</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDate(viewRecord.date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge
                      variant="outline"
                      className={statusStyles[viewRecord.status]}
                    >
                      {viewRecord.status}
                    </Badge>
                  </dd>
                </div>
              </dl>
              {Object.keys(viewRecord.fields).length === 0 && (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  This is a sample record with no saved form details.
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewRecord(null)}>
                  Close
                </Button>
                <Button onClick={() => printNow(viewRecord)}>
                  <Printer aria-hidden="true" />
                  Print
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* History */}
      <section className="print:hidden overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-4 border-b p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Issuance History</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Showing {filteredIssuances.length} of {allRecords.length}{" "}
                records
              </p>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setHistoryType("All document types")
                }}
              >
                <X aria-hidden="true" />
                Reset filters
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search issuance history</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by reference, resident, type, or date"
                className={cn(inputClassName, "pl-9")}
              />
            </label>
            <label className="sm:w-72">
              <span className="sr-only">Filter by document type</span>
              <select
                value={historyType}
                onChange={(event) => setHistoryType(event.target.value)}
                className={inputClassName}
              >
                <option>All document types</option>
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Record ID
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Resident
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Document
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIssuances.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-medium">
                    {item.id}
                  </td>
                  <td className="px-5 py-3.5 font-medium">{item.resident}</td>
                  <td className="max-w-xs px-5 py-3.5 text-muted-foreground">
                    {item.type}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                    {formatDate(item.date)}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant="outline"
                      className={statusStyles[item.status]}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewRecord(item)}
                        aria-label={"View " + item.id}
                      >
                        <Eye aria-hidden="true" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printNow(item)}
                        aria-label={"Print " + item.id}
                      >
                        <Printer aria-hidden="true" />
                        Print
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y md:hidden">
          {filteredIssuances.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.resident}</p>
                  <p className="text-sm text-muted-foreground">{item.type}</p>
                </div>
                <Badge variant="outline" className={statusStyles[item.status]}>
                  {item.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{item.id}</span> ·{" "}
                {formatDate(item.date)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setViewRecord(item)}
                >
                  <Eye aria-hidden="true" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => printNow(item)}
                >
                  <Printer aria-hidden="true" />
                  Print
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {filteredIssuances.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="size-6" aria-hidden="true" />
            </div>
            <p className="font-medium">No records found</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try a different search or document type, or create a new issuance.
            </p>
          </div>
        )}
      </section>

      <section
        id="issuance-print"
        className="hidden print:block p-6 text-black"
      >
        <p className="text-sm">
          Selected document: {printRecord?.type ?? selectedType}
        </p>
        <p className="text-sm" />
      </section>
    </div>
  )
}
