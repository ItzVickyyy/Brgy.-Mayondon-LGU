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
import { useMemo, useState } from "react"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { RowActions } from "@/components/Common/RowActions"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import {
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
  const initialResident = sampleResidents.find((resident) => resident.name === getPreselectedResident() || resident.id === getPreselectedResident())
  const [isIssuanceModalOpen, setIsIssuanceModalOpen] = useState(() => Boolean(getPreselectedResident()))
  const [selectedType, setSelectedType] = useState(documentTypes[0])
  const [residentQuery, setResidentQuery] = useState("")
  const [selectedResidentId, setSelectedResidentId] = useState(() => initialResident?.id ?? "")
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
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const defaults = createDefaultFormValues(documentTypes[0])
    if (!initialResident) return { ...defaults, ...(getPreselectedResident() ? { name: getPreselectedResident() } : {}) }
    const name = formatPrintedName(initialResident.firstName, initialResident.middleName, initialResident.lastName, documentTypes[0])
    return {
      ...defaults,
      residentId: initialResident.id,
      firstName: initialResident.firstName,
      middleName: initialResident.middleName,
      lastName: initialResident.lastName,
      name,
      address: initialResident.address.replace(/, Mayondon.*$/i, ""),
      birthdate: initialResident.birthdate,
      birthplace: initialResident.birthplace,
      civilStatus: initialResident.civilStatus,
      sector: initialResident.sectors.join("||"),
      age: calculateAge(initialResident.birthdate, defaults.date || localDateValue()),
    }
  })
  const [drafts, setDrafts] = useState<IssuanceRecord[]>([])
  const [printRecord, setPrintRecord] = useState<IssuanceRecord | null>(null)
  const [viewRecord, setViewRecord] = useState<IssuanceRecord | null>(null)
  const [notice, setNotice] = useState("")
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
  const defaultsForDirtyCheck = createDefaultFormValues(selectedType)
  const isDirty = Object.entries(formValues).some(([key, value]) => value.trim() !== (defaultsForDirtyCheck[key] ?? "").trim())

  function updateField(name: string, value: string) {
    const nextValue = ["motorNumber", "plateNumber", "name"].includes(name) ? value.toUpperCase() :
      name === "officialReceiptNumber" && value.trim().toUpperCase() === "FOC" ? "FOC" : value
    setFormValues((previous) => {
      const next: Record<string, string> = {
        ...previous,
        [name]: nextValue,
        ...(name === "birthdate" ? { age: calculateAge(nextValue, previous.date || localDateValue()) } : {}),
        ...(name === "date" ? { age: calculateAge(previous.birthdate || "", nextValue) } : {}),
        ...(name === "recipientChoice" && nextValue === "Oneself" ? { underName: previous.name ?? "" } : {}),
        ...(name === "recipientChoice" && nextValue === "His or her" ? { underName: "" } : {}),
      }
      if (["firstName", "middleName", "lastName"].includes(name)) {
        next.name = formatPrintedName(
          next.firstName ?? "",
          next.middleName ?? "",
          next.lastName ?? "",
          selectedType,
        )
        if (next.recipientChoice === "Oneself") next.underName = next.name
      }
      return next
    })
    setValidationErrors((previous) => { const next = { ...previous }; delete next[name]; return next })
    setFormErrorSummary([])
    setNotice("")
  }

  function changeDocumentType(value: string) {
    const sharedKeys = ["firstName", "middleName", "lastName", "name", "birthdate", "age", "birthplace", "civilStatus", "address", "residentId", "photoUrl"]
    const previousFields = documentSections[selectedType]?.flatMap((section) => section.fields) ?? []
    const lost = previousFields.some((field) => !sharedKeys.includes(field.name) && field.name !== "date" && Boolean(formValues[field.name]?.trim()) && formValues[field.name] !== (field.defaultValue ?? ""))
    const preserved = Object.fromEntries(sharedKeys.filter((key) => formValues[key]).map((key) => [key, formValues[key]]))
    const defaults = createDefaultFormValues(value)
    const residentRecord = sampleResidents.find((resident) => resident.id === selectedResidentId)
    const name = formValues.firstName || formValues.lastName
      ? formatPrintedName(formValues.firstName ?? "", formValues.middleName ?? "", formValues.lastName ?? "", value)
      : formValues.name ?? ""
    setSelectedType(value)
    setFormValues({
      ...defaults,
      ...preserved,
      name,
      age: calculateAge(formValues.birthdate ?? "", defaults.date ?? localDateValue()),
      ...(residentRecord ? { sector: value === "Certification (assistance request)" ? residentRecord.sectors[0] ?? "" : residentRecord.sectors.slice(0, 2).join("||") } : {}),
    })
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
      sector: selectedType === "Certification (assistance request)" ? resident.sectors[0] ?? "" : resident.sectors.join("||"),
      residencyDuration: resident.residentSince ? String(Math.max(0, new Date(`${previous.date || localDateValue()}T00:00:00`).getFullYear() - resident.residentSince)) : "",
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

  function startManualEntry() {
    setSelectedResidentId("")
    setResidentQuery("")
    setManualEntry(true)
    setFormValues((previous) => ({
      ...createDefaultFormValues(selectedType),
      date: previous.date || localDateValue(),
    }))
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
    if (!formValues.date?.trim()) errors.date = "Date on document is required."
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
      fields: { ...formValues, officialReceiptNumber: formValues.officialReceiptNumber?.trim().toUpperCase() === "FOC" ? "FOC" : formValues.officialReceiptNumber?.trim() ?? "" },
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
      ? formValues.birthdate ? calculateAge(formValues.birthdate, formValues.date || localDateValue()) : (selectedType === "Certificate of Indigency" ? formValues.ageManual ?? "" : "")
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
        ) : field.name === "addressedTo" ? (
          <div className="flex min-w-0 items-stretch">
            <span className="inline-flex min-h-11 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs font-normal text-muted-foreground">Addressed to the office of</span>
            <input id={fieldId} value={value} onChange={(event) => updateField(field.name, event.target.value)} className={cn(inputClassName, "min-w-0 rounded-l-none", error && "border-destructive")} aria-invalid={Boolean(error)} />
          </div>
        ) : field.type === "readonly" ? (
          <input id={fieldId} value={value} readOnly placeholder={field.name === "age" ? (formValues.birthdate ? "Unable to calculate age" : "Enter birthdate") : undefined} className={cn(inputClassName, "bg-muted/50")} />
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
      <Dialog open={isIssuanceModalOpen} onOpenChange={requestCloseForm}>
        <DialogContent className="print:hidden flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6">
            <DialogTitle className="text-lg">New Issuance</DialogTitle>
            <DialogDescription>Fill in the details once, then check the print preview. Fields marked * are required to issue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => event.preventDefault()} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
              {formErrorSummary.length > 0 ? (
                <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
                  <p className="font-semibold">{formErrorSummary.length} field{formErrorSummary.length === 1 ? "" : "s"} need attention</p>
                  <ul className="mt-2 list-disc pl-5">
                    {formErrorSummary.map((key) => {
                      const field = allFormFields.find((item) => item.name === key)
                      return <li key={key}><button type="button" className="min-h-8 text-left underline underline-offset-4" onClick={() => { const target = document.getElementById(`field-${key}`); target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.focus() }}>{field?.label ?? key}: {validationErrors[key]}</button></li>
                    })}
                  </ul>
                </div>
              ) : null}
              {lostDetailsNotice ? <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">{lostDetailsNotice}</p> : null}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <div className="min-w-0 space-y-4">
                  <FormSection title="① DOCUMENT" description="Choose the pre-printed paper that matches the request.">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 md:col-span-2">
                      {documentTypes.map((type) => (
                        <label key={type} className={cn("flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/50", selectedType === type ? "border-primary bg-primary/5" : "bg-background hover:bg-muted")}>
                          <input type="radio" name="documentType" checked={selectedType === type} onChange={() => changeDocumentType(type)} className="mt-1 size-4 accent-primary" />
                          <span><span className="block font-medium">{type}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{type === "Barangay Clearance" ? "Employment, school, loans, residency" : type === "Barangay Franchise Clearance" ? "Tricycle franchise details" : type === "Barangay Clearance, Electrical and Water Connection" ? "Electric or water connection" : type === "Certificate of Indigency" ? "Sector and purpose certification" : "Financial, medical, or burial assistance"}</span></span>
                        </label>
                      ))}
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="field-date" className={labelClassName}>Date on document <span className="text-destructive">*</span></label>
                      <input id="field-date" type="date" value={formValues.date ?? localDateValue()} onChange={(event) => updateField("date", event.target.value)} className={cn(inputClassName, validationErrors.date && "border-destructive")} aria-invalid={Boolean(validationErrors.date)} aria-describedby={validationErrors.date ? "field-date-error" : undefined} required />
                      {validationErrors.date ? <p id="field-date-error" className="text-xs text-destructive">{validationErrors.date}</p> : null}
                    </div>
                  </FormSection>

                  <FormSection title="② RESIDENT" description="Search the resident record or enter the details manually.">
                    <div className="md:col-span-2">
                      <label htmlFor="resident-search" className="mb-1.5 block text-sm font-medium">Search name or ID number</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input id="resident-search" role="combobox" aria-autocomplete="list" aria-expanded={residentMatches.length > 0} aria-controls="resident-results" value={residentQuery} onChange={(event) => { setResidentQuery(event.target.value); setActiveResidentMatch(0); setSelectedResidentId("") }} onKeyDown={(event) => {
                          if (event.key === "ArrowDown" && residentMatches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.min(index + 1, residentMatches.length - 1)) }
                          if (event.key === "ArrowUp" && residentMatches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.max(index - 1, 0)) }
                          if (event.key === "Enter" && residentMatches[activeResidentMatch]) { event.preventDefault(); selectResident(residentMatches[activeResidentMatch]) }
                          if (event.key === "Escape") setResidentQuery("")
                        }} placeholder="Search name or ID number…" className={cn(inputClassName, "pl-9")} />
                      </div>
                      {residentQuery.trim() && !selectedResidentId && !manualEntry ? (
                        <div id="resident-results" role="listbox" aria-label="Resident search results" className="mt-2 overflow-hidden rounded-xl border bg-card">
                          {residentMatches.length ? residentMatches.map((resident, index) => (
                            <button key={resident.id} type="button" role="option" aria-selected={activeResidentMatch === index} onMouseEnter={() => setActiveResidentMatch(index)} onClick={() => selectResident(resident)} className={cn("flex min-h-14 w-full flex-col items-start gap-1 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/60", activeResidentMatch === index && "bg-muted")}>
                              <span className="font-medium">{resident.name} <span className="font-mono text-xs text-muted-foreground">{resident.id}</span></span>
                              <span className="text-xs text-muted-foreground">{resident.address} · ID status: {resident.idStatus}</span>
                            </button>
                          )) : <p className="px-3 py-4 text-sm text-muted-foreground">No match. Enter details manually.</p>}
                        </div>
                      ) : null}
                      {selectedResidentId ? <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"><span className="min-w-0"><strong>{sampleResidents.find((resident) => resident.id === selectedResidentId)?.name ?? "Selected resident"}</strong><span className="ml-2 font-mono text-xs text-muted-foreground">{selectedResidentId}</span><span className="mt-1 block text-xs text-muted-foreground">{sampleResidents.find((resident) => resident.id === selectedResidentId)?.address ?? ""}</span></span><Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => { setSelectedResidentId(""); setResidentQuery(""); setManualEntry(false) }}>Change</Button></div> : null}
                      {!manualEntry && !selectedResidentId ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"><button type="button" className="min-h-11 text-primary underline underline-offset-4" onClick={startManualEntry}>Resident not found? Enter details manually</button><button type="button" className="min-h-11 text-muted-foreground underline underline-offset-4" onClick={() => setNotice("Add to Resident Records is not connected yet. Open Resident Records to add a record.")}>Add to Resident Records</button></div> : null}
                      <p className="mt-2 text-xs text-muted-foreground">Changes here apply to this document only. To change the resident's record, use Resident Records.</p>
                    </div>
                    {(documentSections[selectedType] ?? []).find((section) => section.id === "resident")?.fields.map(renderField)}
                  </FormSection>

                  {(documentSections[selectedType] ?? []).filter((section) => !["resident", "receipt"].includes(section.id)).map((section) => (
                    <FormSection key={section.id} title={section.title === "Clearance details" ? "③ CLEARANCE DETAILS" : section.title === "Connection service" ? "③ DOCUMENT DETAILS" : section.title === "Franchise details" ? "③ FRANCHISE DETAILS" : section.title === "Connection details" ? "③ CONNECTION DETAILS" : section.title === "Indigency details" ? "③ INDIGENCY DETAILS" : "③ ASSISTANCE DETAILS"} description={section.description}>
                      {section.fields.map(renderField)}
                    </FormSection>
                  ))}
                  {(documentSections[selectedType] ?? []).filter((section) => section.id === "receipt").map((section) => (
                    <FormSection key={section.id} title="④ IDENTIFICATION & RECEIPT" description="Enter the details from the CTC or identification document.">
                      {section.fields.map(renderField)}
                    </FormSection>
                  ))}
                </div>

                <aside className="min-w-0 rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-0">
                  <h3 className="font-semibold tracking-tight">Will print</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedType}</p>
                  <p className="mt-1 text-sm font-medium">{formatPaperDate(currentDate)}</p>
                  <div className="my-4 border-t" />
                  <dl className="space-y-3 text-sm">
                    {[
                      [selectedType === "Certification (assistance request)" ? "Mr./Ms." : "NAME", formValues.name],
                      ["ADDRESS", formValues.address],
                      ...(selectedType === "Barangay Clearance" ? [["AGE", calculateAge(formValues.birthdate ?? "", currentDate) ? `${calculateAge(formValues.birthdate ?? "", currentDate)} years old` : ""] , ["BIRTHDATE", formValues.birthdate ? formatPaperDate(formValues.birthdate) : ""], ["BIRTHPLACE", formValues.birthplace], ["CIVIL STATUS", formValues.civilStatus], ["PURPOSE", formValues.purpose], ["PURPOSE note", formValues.purposeNote], ["REMARKS", formValues.remarks], ["c/o", formValues.referredBy], ["Valid I.D. Presented", formValues.validIdPresented], ["Number", formValues.idNumber], ["Place of Issue", formValues.idPlaceOfIssue], ["Date of Issue", formValues.idDateOfIssue ? formatPaperDate(formValues.idDateOfIssue) : ""], ["Paid under OFFICIAL RECEIPT No.", formValues.officialReceiptNumber]] : []),
                      ...(selectedType === "Barangay Franchise Clearance" ? [["TRICYCLE ASSOCIATION", formValues.tricycleAssociation], ["MAKE", formValues.make], ["TYPE OF BODY", formValues.typeOfBody], ["MOTOR NO", formValues.motorNumber], ["COLOR", formValues.color], ["PLATE NUMBER", formValues.plateNumber], ["CTC Number", formValues.ctcNumber], ["Place of Issue", formValues.ctcPlaceOfIssue], ["Date of Issue", formValues.ctcDateOfIssue ? formatPaperDate(formValues.ctcDateOfIssue) : ""], ["Paid under OFFICIAL RECEIPT No.", formValues.officialReceiptNumber]] : []),
                      ...(selectedType === "Barangay Clearance, Electrical and Water Connection" ? [["Service", formValues.serviceType?.split("||").join(" / ")], ["TYPE OF CONNECTION", formValues.connectionType], ["CLASSIFICATION", formValues.classification], ["LOCATION", formValues.location], ["CTC Number", formValues.ctcNumber], ["Place of Issue", formValues.ctcPlaceOfIssue], ["Date of Issue", formValues.ctcDateOfIssue ? formatPaperDate(formValues.ctcDateOfIssue) : ""], ["Paid under OFFICIAL RECEIPT No.", formValues.officialReceiptNumber]] : []),
                      ...(selectedType === "Certificate of Indigency" ? [["AGE", calculateAge(formValues.birthdate ?? "", currentDate) ? `${calculateAge(formValues.birthdate ?? "", currentDate)} years old` : formValues.ageManual], ["SECTOR :", formValues.sector?.split("||").join(" / ")], ["PURPOSE", formValues.purpose], ["Addressed to the office of", formValues.addressedTo]] : []),
                      ...(selectedType === "Certification (assistance request)" ? [["Resident of", formValues.address], ["For a period of years", formValues.residencyDuration], ["Member of the sector", formValues.sector], ["Assistance requested", formValues.assistanceType], ["For", formValues.recipientChoice === "His or her" ? `his or her ${formValues.recipientRelationship ?? ""}` : formValues.recipientChoice], ["Under the name of", formValues.underName], ["Given this", currentDate ? `${getDateParts(currentDate).day} day of ${getDateParts(currentDate).month}` : ""]] : []),
                    ].map(([label, rawValue]) => {
                      const value = (rawValue ?? "").trim()
                      return <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className={cn("break-words text-right text-sm", !value && "font-medium text-amber-600")} >{value || <span className="inline-flex items-center gap-1"><AlertCircle className="size-3.5" aria-hidden="true" />Missing</span>}</dd></div>
                    })}
                  </dl>
                  <div className="my-4 border-t" />
                  <p className="text-sm font-semibold">Missing ({allFormFields.filter((field) => field.required && !field.showWhen?.(formValues) && !formValues[field.name]?.trim()).length + (currentDate ? 0 : 1)})</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {[...allFormFields.filter((field) => field.required && !field.showWhen?.(formValues) && !formValues[field.name]?.trim()).map((field) => ({ name: field.name, label: field.label })), ...(!currentDate ? [{ name: "date", label: "Date on document" }] : [])].map((field) => <li key={field.name}><button type="button" className="min-h-8 text-left text-amber-700 underline underline-offset-4" onClick={() => { const target = document.getElementById(`field-${field.name}`); target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.focus() }}>{field.label}</button></li>)}
                  </ul>
                  <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">After printing: {selectedType === "Barangay Clearance" ? "Resident signs and thumbmarks; apply the dry seal." : selectedType === "Certification (assistance request)" ? "Kagawad signs." : "Apply the dry seal."}</p>
                </aside>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 border-t bg-card px-4 py-3 sm:flex-row sm:items-center sm:px-6">
              <Button type="button" variant="ghost" size="lg" className="sm:mr-auto" onClick={clearForm}><Eraser aria-hidden="true" />Clear form</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => saveIssuance(true)}>Save as draft</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => preparePrint()}><Eye aria-hidden="true" />Print preview</Button>
              <Button type="button" size="lg" onClick={() => saveIssuance(false)}><FileCheck2 aria-hidden="true" />Save as issued</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmFormAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmFormAction(null) }}
        title={confirmFormAction === "clear" ? "Clear form?" : "Discard this form?"}
        description={confirmFormAction === "clear" ? "Clear the entered values from this form?" : "Close the form and discard its unsaved entries?"}
        confirmLabel={confirmFormAction === "clear" ? "Clear form" : "Discard form"}
        destructive
        onConfirm={() => {
          if (confirmFormAction === "clear") performClearForm()
          else {
            setConfirmFormAction(null)
            setIsIssuanceModalOpen(false)
            setContinueTarget(null)
            setCorrectionTarget(null)
            setCorrectionReason("")
            setValidationErrors({})
            setFormErrorSummary([])
          }
        }}
      />

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
