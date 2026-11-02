import { createFileRoute } from "@tanstack/react-router"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eraser,
  Eye,
  FileCheck2,
  FileText,
  Plus,
  Printer,
  Search,
  X,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { RowActions } from "@/components/Common/RowActions"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  type DocumentField,
  documentFields,
  documentSections,
  documentTypes,
  type IssuanceRecord,
  sampleIssuances,
} from "@/components/Issuances/config"
import { FormSection, SummaryCard } from "@/components/Issuances/IssuanceLayout"
import { sampleResidents } from "@/components/Records/records-sample-data"
import { calculateAge, formatPaperDate, formatPrintedName, getDateParts } from "@/lib/issuance-format"
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
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/issuances")({
  component: IssuancesManagement,
  head: () => ({ meta: [{ title: pageTitle("Issuances Management") }] }),
})

const inputClassName = formControlClass
const labelClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-medium"

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
    (documentFields[type] ?? []).flatMap((field) => {
      if (field.defaultToday) return [[field.name, today]]
      if (field.defaultValue) return [[field.name, field.defaultValue]]
      return []
    }),
  ) as Record<string, string>
}

function formatDate(value: string) {
  if (!value) return "Not entered"
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
}

function getPreselectedResident() {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("resident") ?? ""
}

function IssuancesManagement() {
  const [isIssuanceModalOpen, setIsIssuanceModalOpen] = useState(() => Boolean(getPreselectedResident()))
  const [selectedType, setSelectedType] = useState(documentTypes[0])
  const [residentQuery, setResidentQuery] = useState("")
  const [selectedResidentId, setSelectedResidentId] = useState("")
  const [manualEntry, setManualEntry] = useState(false)
  const [activeResidentMatch, setActiveResidentMatch] = useState(0)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [formErrorSummary, setFormErrorSummary] = useState<string[]>([])
  const [confirmFormAction, setConfirmFormAction] = useState<"clear" | "discard" | null>(null)
  const [lostDetailsNotice, setLostDetailsNotice] = useState("")
  const [usedAssociations, setUsedAssociations] = useState<string[]>([])
  const [usedIndigencyPurposes, setUsedIndigencyPurposes] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [historyType, setHistoryType] = useState("All document types")
  const [historyStatus, setHistoryStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [historyRecords, setHistoryRecords] = useState<IssuanceRecord[]>(sampleIssuances)
  const [pendingAction, setPendingAction] = useState<{ record: IssuanceRecord; action: "void" | "correct" | "discard" } | null>(null)
  const [correctionReason, setCorrectionReason] = useState("")
  const [correctionTarget, setCorrectionTarget] = useState<IssuanceRecord | null>(null)
  const [continueTarget, setContinueTarget] = useState<IssuanceRecord | null>(null)
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [formValues, setFormValues] = useState<Record<string, string>>(() => ({
    ...createDefaultFormValues(documentTypes[0]),
    ...(getPreselectedResident() ? { name: getPreselectedResident() } : {}),
  }))
  const [drafts, setDrafts] = useState<IssuanceRecord[]>([])
  const [printRecord, setPrintRecord] = useState<IssuanceRecord | null>(null)
  const [viewRecord, setViewRecord] = useState<IssuanceRecord | null>(null)
  const [notice, setNotice] = useState("")
  const firstInvalidRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null)

  const fields = documentFields[selectedType] ?? []
  const currentName = formValues.name?.trim() || "Name not entered"
  const currentDate = formValues.date || ""
  const allRecords = useMemo(() => [...drafts, ...historyRecords], [drafts, historyRecords])
  const filteredIssuances = useMemo(
    () =>
      allRecords
        .filter((item) => {
          const query = search.trim().toLowerCase()
          const matchesSearch = [
            item.id,
            item.resident,
            item.type,
            item.date,
            item.status,
            item.purpose ?? "",
          ].some((value) => value.toLowerCase().includes(query))
          const matchesType = historyType === "All document types" || item.type === historyType
          const matchesStatus = historyStatus === "all" || item.status === historyStatus
          return matchesSearch && matchesType && matchesStatus &&
            (!startDate || item.date >= startDate) &&
            (!endDate || item.date <= endDate)
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allRecords, endDate, historyStatus, historyType, search, startDate],
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
  const hasFilters = search.trim() !== "" || historyType !== "All document types" || historyStatus !== "all" || startDate !== "" || endDate !== ""

  const residentMatches = useMemo(() => {
    const query = residentQuery.trim().toLowerCase()
    if (!query || selectedResidentId || manualEntry) return []
    return sampleResidents.filter((resident) => resident.status === "Active")
      .filter((resident) => [resident.name, resident.id, resident.idNumber, resident.address].some((value) => value.toLowerCase().includes(query)))
      .slice(0, 6)
  }, [residentQuery, selectedResidentId, manualEntry])

  const allFormFields = documentSections[selectedType]?.flatMap((section) => section.fields) ?? []
  const isDirty = Object.entries(formValues).some(([key, value]) => key !== "date" && value.trim() !== "")

  function updateField(name: string, value: string) {
    const nextValue = ["motorNumber", "plateNumber"].includes(name) ? value.toUpperCase() :
      name === "officialReceiptNumber" && value.trim().toUpperCase() === "FOC" ? "FOC" : value
    setFormValues((previous) => ({
      ...previous,
      [name]: nextValue,
      ...(name === "birthdate" ? { age: calculateAge(nextValue, previous.date || localDateValue()) } : {}),
      ...(name === "date" ? { age: calculateAge(previous.birthdate || "", nextValue) } : {}),
    }))
    setValidationErrors((previous) => { const next = { ...previous }; delete next[name]; return next })
    setFormErrorSummary([])
    setNotice("")
  }

  function changeDocumentType(value: string) {
    const sharedKeys = ["firstName", "middleName", "lastName", "birthdate", "birthplace", "civilStatus", "address", "residentId", "photoUrl"]
    const previousFields = documentSections[selectedType]?.flatMap((section) => section.fields) ?? []
    const lost = previousFields.some((field) => !sharedKeys.includes(field.name) && Boolean(formValues[field.name]?.trim()))
    const preserved = Object.fromEntries(sharedKeys.filter((key) => formValues[key]).map((key) => [key, formValues[key]]))
    const defaults = createDefaultFormValues(value)
    const name = formValues.firstName || formValues.lastName
      ? formatPrintedName(formValues.firstName ?? "", formValues.middleName ?? "", formValues.lastName ?? "", value)
      : formValues.name ?? ""
    setSelectedType(value)
    setFormValues({ ...defaults, ...preserved, name, age: calculateAge(formValues.birthdate ?? "", defaults.date ?? localDateValue()) })
    setValidationErrors({})
    setFormErrorSummary([])
    setLostDetailsNotice(lost ? `Details for ${selectedType} were cleared.` : "")
    setPrintRecord(null)
  }

  function selectResident(resident: (typeof sampleResidents)[number]) {
    const name = formatPrintedName(resident.firstName, resident.middleName, resident.lastName, selectedType)
    setFormValues((previous) => ({
      ...previous,
      residentId: resident.id,
      firstName: resident.firstName,
      middleName: resident.middleName,
      lastName: resident.lastName,
      name,
      address: resident.address.replace(/, Mayondon.*$/i, ""),
      birthdate: resident.birthdate,
      birthplace: resident.birthplace,
      civilStatus: resident.civilStatus,
      sector: resident.sectors.join("||"),
      residencyDuration: resident.residentSince ? String(Math.max(0, new Date().getFullYear() - resident.residentSince)) : "",
      age: calculateAge(resident.birthdate, previous.date || localDateValue()),
      photoUrl: resident.photoUrl ?? "",
      ...(previous.recipientChoice === "Oneself" ? { underName: name } : {}),
    }))
    setSelectedResidentId(resident.id)
    setResidentQuery("")
    setManualEntry(false)
    setValidationErrors({})
    setFormErrorSummary([])
  }

  function performClearForm() {
    setFormValues(createDefaultFormValues(selectedType))
    setSelectedResidentId("")
    setResidentQuery("")
    setManualEntry(false)
    setValidationErrors({})
    setFormErrorSummary([])
    setLostDetailsNotice("")
    setConfirmFormAction(null)
    setPrintRecord(null)
  }

  function clearForm() {
    if (isDirty) setConfirmFormAction("clear")
    else performClearForm()
  }

  function requestCloseForm(open: boolean) {
    if (open) return setIsIssuanceModalOpen(true)
    if (isDirty) return setConfirmFormAction("discard")
    setIsIssuanceModalOpen(false)
    setContinueTarget(null)
    setCorrectionTarget(null)
    setCorrectionReason("")
  }

  function validateIssuedForm() {
    const errors: Record<string, string> = {}
    for (const field of allFormFields) {
      if (field.showWhen && !field.showWhen(formValues)) continue
      if (field.required && !formValues[field.name]?.trim()) errors[field.name] = `${field.label} is required.`
    }
    if (selectedType === "Barangay Clearance, Electrical and Water Connection" && !formValues.serviceType?.trim()) errors.serviceType = "Choose at least one service."
    if (selectedType === "Certificate of Indigency" && !formValues.birthdate?.trim() && !formValues.ageManual?.trim()) errors.ageManual = "Enter age when birthdate is unavailable."
    for (const key of ["idDateOfIssue", "ctcDateOfIssue"]) {
      if (formValues[key] && formValues[key] > localDateValue()) errors[key] = "Date of issue cannot be in the future."
    }
    setValidationErrors(errors)
    const names = Object.keys(errors)
    setFormErrorSummary(names)
    if (names.length) window.setTimeout(() => {
      const field = document.getElementById(`field-${names[0]}`)
      field?.scrollIntoView({ behavior: "smooth", block: "center" })
      field?.focus()
    }, 0)
    return names.length > 0
  }

  function saveIssuance(asDraft = false) {
    if (!formValues.name?.trim()) {
      setValidationErrors({ name: "Name is required." })
      setFormErrorSummary(["name"])
      document.getElementById("field-name")?.focus()
      return
    }
    if (!asDraft && validateIssuedForm()) return
    if (continueTarget && !asDraft) {
      setHistoryRecords((previous) => previous.map((item) => item.id === continueTarget.id
        ? { ...item, resident: currentName, date: currentDate, status: "Issued", purpose: formValues.purpose || item.purpose, fields: { ...formValues } }
        : item))
      setNotice(`${continueTarget.id} was continued and marked as issued.`)
      setContinueTarget(null)
      setIsIssuanceModalOpen(false)
      return
    }
    const sequence = allRecords.reduce((max, item) => Math.max(max, Number(item.id.match(/\\d+$/)?.[0] ?? 0)), 0) + 1
    const record: IssuanceRecord = {
      id: `ISS-${String(sequence).padStart(3, "0")}`,
      resident: currentName,
      type: selectedType,
      date: currentDate || localDateValue(),
      status: asDraft ? "Pending" : "Issued",
      purpose: formValues.purpose,
      validUntil: formValues.validUntil,
      correctionReason: correctionTarget ? correctionReason : undefined,
      fields: { ...formValues, officialReceiptNumber: formValues.officialReceiptNumber?.trim().toUpperCase() ?? "" },
    }
    setDrafts((previous) => [record, ...previous])
    if (selectedType === "Barangay Franchise Clearance" && formValues.tricycleAssociation?.trim()) setUsedAssociations((previous) => Array.from(new Set([...previous, formValues.tricycleAssociation.trim()])))
    if (selectedType === "Certificate of Indigency" && formValues.purpose?.trim()) setUsedIndigencyPurposes((previous) => Array.from(new Set([...previous, formValues.purpose.trim()])))
    setNotice(asDraft ? `${record.id} was saved as a pending draft.` : `${record.id} was recorded as issued.`)
    setCorrectionTarget(null)
    setCorrectionReason("")
    setIsIssuanceModalOpen(false)
  }

  function preparePrint(record?: IssuanceRecord) {
    setPrintRecord(record ?? { id: "PRINT-PREVIEW", resident: currentName, type: selectedType, date: currentDate, status: "Pending", fields: { ...formValues } })
    setNotice("")
  }

  function printNow(record?: IssuanceRecord) {
    preparePrint(record)
    window.setTimeout(() => window.print(), 100)
  }

  function renderField(field: (typeof allFormFields)[number]) {
    if (field.showWhen && !field.showWhen(formValues)) return null
    const value = field.name === "age"
      ? calculateAge(formValues.birthdate ?? "", formValues.date || localDateValue()) || (selectedType === "Certificate of Indigency" ? formValues.ageManual ?? "" : "")
      : formValues[field.name] ?? ""
    const error = validationErrors[field.name]
    const fieldId = `field-${field.name}`
    const options = field.name === "tricycleAssociation" ? usedAssociations :
      field.name === "purpose" && selectedType === "Certificate of Indigency" ? usedIndigencyPurposes :
      field.options ?? []
    const wrapperClass = cn(labelClassName, field.span === 3 && "md:col-span-2")
    return (
      <div key={field.name} className={wrapperClass} id={`wrap-${field.name}`}>
        <label htmlFor={fieldId}>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</label>
        {field.type === "radio" || field.type === "checkboxes" || field.type === "multiselect" ? (
          <fieldset className="min-w-0"><legend className="sr-only">{field.label}</legend><div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((option) => {
              const multi = field.type !== "radio"
              const selected = multi ? value.split("||").filter(Boolean).includes(option) : value === option
              return <label key={option} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-normal focus-within:ring-[3px] focus-within:ring-ring/50", selected ? "border-primary bg-primary/10" : "bg-background hover:bg-muted")}>
                <input type={multi ? "checkbox" : "radio"} name={field.name} checked={selected} onChange={(event) => {
                  if (!multi) updateField(field.name, option)
                  else {
                    const values = value.split("||").filter(Boolean)
                    const next = event.target.checked ? [...values, option].slice(-(field.maxSelected ?? 99)) : values.filter((item) => item !== option)
                    updateField(field.name, next.join("||"))
                  }
                }} className="size-4 accent-primary" />{option}
              </label>
            })}
          </div></fieldset>
        ) : field.type === "select" ? (
          <select id={fieldId} value={value} onChange={(event) => updateField(field.name, event.target.value)} className={cn(inputClassName, error && "border-destructive")} aria-invalid={Boolean(error)}><option value="">Select {field.label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        ) : field.type === "combobox" ? (
          <><input id={fieldId} value={value} onChange={(event) => updateField(field.name, event.target.value)} list={`list-${field.name}`} className={cn(inputClassName, error && "border-destructive")} aria-invalid={Boolean(error)} /><datalist id={`list-${field.name}`}>{[...(field.options ?? []), ...options].map((option) => <option key={option} value={option} />)}</datalist></>
        ) : field.type === "readonly" ? (
          <input id={fieldId} value={value} readOnly className={cn(inputClassName, "bg-muted/50")} />
        ) : field.type === "textarea" ? (
          <textarea id={fieldId} value={value} onChange={(event) => updateField(field.name, event.target.value)} className={cn(inputClassName, "h-auto py-2", error && "border-destructive")} aria-invalid={Boolean(error)} rows={2} />
        ) : (
          <input id={fieldId} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={value} onChange={(event) => updateField(field.name, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault() }} max={field.name.toLowerCase().includes("dateofissue") ? localDateValue() : undefined} min={field.type === "number" ? "0" : undefined} className={cn(inputClassName, error && "border-destructive")} aria-invalid={Boolean(error)} />
        )}
        {field.help ? <p className="text-xs font-normal text-muted-foreground">{field.help}</p> : null}
        {field.name === "purpose" && selectedType === "Barangay Clearance" && formValues.purpose === "Employment Requirement/First Time Jobseeker" ? <button type="button" className="min-h-11 text-left text-xs text-primary underline underline-offset-4" onClick={() => updateField("purposeNote", "NOT APPLICABLE FOR LOAN PURPOSES")}>Use note: NOT APPLICABLE FOR LOAN PURPOSES</button> : null}
        {error ? <p id={`${fieldId}-error`} className="text-xs font-normal text-destructive">{error}</p> : null}
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
          className="min-h-11 w-full sm:w-auto"
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
          <Button variant="ghost" size="icon" className="size-11" onClick={() => setNotice("")} aria-label="Dismiss message">
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="print:hidden grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      <Dialog open={isIssuanceModalOpen} onOpenChange={(open) => { setIsIssuanceModalOpen(open); if (!open) { setContinueTarget(null); setCorrectionTarget(null); setCorrectionReason("") } }}>
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
              <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
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
                  <dt className="text-xs text-muted-foreground">Purpose</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.purpose || viewRecord.fields.purpose || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valid until</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.validUntil ? formatDate(viewRecord.validUntil) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Issued by</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.issuedBy || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">OR number</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.orNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Correction reason</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.correctionReason || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Void reason</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.voidReason || "—"}</dd>
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
                  Record details are unavailable.
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewRecord(null)}>
                  Close
                </Button>
                {viewRecord.status === "Issued" ? (
                  <Button onClick={() => printNow(viewRecord)}>
                    <Printer aria-hidden="true" />
                    Reprint
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) setPendingAction(null) }}
        title={
          pendingAction?.action === "void"
            ? "Void issuance?"
            : pendingAction?.action === "correct"
              ? "Correct issuance details?"
              : "Discard draft?"
        }
        description={
          pendingAction
            ? pendingAction.action === "void"
              ? `Void ${pendingAction.record.id}? The issued transaction will remain in history.`
              : pendingAction.action === "correct"
                ? `Create a corrected record based on ${pendingAction.record.id}? The original will remain in history.`
                : `Discard the pending draft ${pendingAction.record.id}?`
            : "Confirm this action."
        }
        confirmLabel={
          pendingAction?.action === "void"
            ? "Void issuance"
            : pendingAction?.action === "correct"
              ? "Continue correction"
              : "Discard draft"
        }
        destructive={pendingAction?.action !== "correct"}
        reason={pendingAction?.action === "discard" ? "none" : "required"}
        onConfirm={(reason) => {
          if (!pendingAction) return
          const { record, action } = pendingAction
          if (action === "void") {
            const updated = { ...record, status: "Voided" as const, voidReason: reason }
            setHistoryRecords((previous) => previous.map((item) => item.id === record.id ? updated : item))
            setDrafts((previous) => previous.map((item) => item.id === record.id ? updated : item))
            setNotice(`${record.id} was marked as voided.`)
          } else if (action === "discard") {
            setHistoryRecords((previous) => previous.filter((item) => item.id !== record.id))
            setDrafts((previous) => previous.filter((item) => item.id !== record.id))
            setNotice(`${record.id} draft was discarded.`)
          } else {
            setCorrectionTarget(record)
            setCorrectionReason(reason)
            setSelectedType(record.type)
            setFormValues({ ...createDefaultFormValues(record.type), ...record.fields, name: record.resident, date: record.date, purpose: record.purpose ?? record.fields.purpose ?? "", validUntil: record.validUntil ?? record.fields.validUntil ?? "" })
            setIsIssuanceModalOpen(true)
          }
          setPendingAction(null)
        }}
      />

      {/* History */}
      <section className="print:hidden overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Issuance History</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Showing {filteredIssuances.length} of {allRecords.length}{" "}
                records
              </p>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setSearch("")
                  setHistoryType("All document types")
                  setHistoryStatus("all")
                  setStartDate("")
                  setEndDate("")
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
            <label className="sm:w-44">
              <span className="sr-only">Filter by status</span>
              <select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)} className={inputClassName}>
                <option value="all">All statuses</option>
                <option>Issued</option>
                <option>Pending</option>
                <option>Voided</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-44">
              <span>From</span>
              <input aria-label="Issued from date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName} />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-44">
              <span>To</span>
              <input aria-label="Issued to date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClassName} />
            </label>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Resident", "Document", "Purpose", "Date issued", "Valid until", "Status", "Actions"].map((label) => (
                  <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 align-middle font-medium sm:px-5"}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIssuances.map((item) => {
                const pending = item.status === "Pending"
                const voided = item.status === "Voided"
                const expired = Boolean(item.validUntil && item.validUntil < localDateValue())
                return (
                  <tr key={item.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 align-middle sm:px-5">
                      <p className="font-semibold">{item.resident}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3 align-middle sm:px-5">{item.type}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">{item.purpose || item.fields.purpose || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">{pending ? "—" : formatDate(item.date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                      {item.validUntil ? (
                        <div className="flex flex-col items-start gap-1">
                          <span>{formatDate(item.validUntil)}</span>
                          {expired ? <Badge variant="outline" className={statusStyles.Expired}>Expired</Badge> : null}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle sm:px-5">
                      <Badge variant="outline" className={statusStyles[item.status]}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3 align-middle sm:px-5">
                      <RowActions
                        name={item.resident}
                        isAdmin={isAdmin}
                        primary={
                          voided
                            ? { label: "View", variant: "outline", onSelect: () => setViewRecord(item) }
                            : pending
                              ? {
                                  label: "Continue",
                                  onSelect: () => {
                                    setContinueTarget(item)
                                    setSelectedType(item.type)
                                    setFormValues({ ...createDefaultFormValues(item.type), ...item.fields, name: item.resident, date: item.date, purpose: item.purpose ?? item.fields.purpose ?? "", validUntil: item.validUntil ?? item.fields.validUntil ?? "" })
                                    setIsIssuanceModalOpen(true)
                                  },
                                }
                              : { label: "Reprint", variant: "outline", icon: <Printer aria-hidden="true" />, onSelect: () => printNow(item) }
                        }
                        items={[
                          { label: "View details", onSelect: () => setViewRecord(item) },
                          { label: "Correct details", hidden: pending || voided, onSelect: () => setPendingAction({ record: item, action: "correct" }) },
                          { label: "Void issuance", adminOnly: true, hidden: pending || voided, destructive: true, onSelect: () => setPendingAction({ record: item, action: "void" }) },
                          { label: "Discard draft", hidden: !pending, destructive: true, onSelect: () => setPendingAction({ record: item, action: "discard" }) },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y md:hidden">
          {filteredIssuances.map((item) => {
            const pending = item.status === "Pending"
            const voided = item.status === "Voided"
            return (
              <li key={item.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.resident}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</p>
                    <p className="mt-2 text-sm">{item.type}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.purpose || item.fields.purpose || "—"}</p>
                  </div>
                  <Badge variant="outline" className={statusStyles[item.status]}>{item.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Date issued</p>
                    <p>{pending ? "—" : formatDate(item.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valid until</p>
                    <p>{item.validUntil ? formatDate(item.validUntil) : "—"}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <RowActions
                    name={item.resident}
                    isAdmin={isAdmin}
                    primary={
                      voided
                        ? { label: "View", variant: "outline", onSelect: () => setViewRecord(item) }
                        : pending
                          ? {
                              label: "Continue",
                              onSelect: () => {
                                setContinueTarget(item)
                                setSelectedType(item.type)
                                setFormValues({ ...createDefaultFormValues(item.type), ...item.fields, name: item.resident, date: item.date, purpose: item.purpose ?? item.fields.purpose ?? "", validUntil: item.validUntil ?? item.fields.validUntil ?? "" })
                                setIsIssuanceModalOpen(true)
                              },
                            }
                          : { label: "Reprint", variant: "outline", icon: <Printer aria-hidden="true" />, onSelect: () => printNow(item) }
                    }
                    items={[
                      { label: "View details", onSelect: () => setViewRecord(item) },
                      { label: "Correct details", hidden: pending || voided, onSelect: () => setPendingAction({ record: item, action: "correct" }) },
                      { label: "Void issuance", adminOnly: true, hidden: pending || voided, destructive: true, onSelect: () => setPendingAction({ record: item, action: "void" }) },
                      { label: "Discard draft", hidden: !pending, destructive: true, onSelect: () => setPendingAction({ record: item, action: "discard" }) },
                    ]}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        {filteredIssuances.length === 0 && (
          <EmptyState
            title="No records found"
            description="Try a different search or document type, or create a new issuance."
          />
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
