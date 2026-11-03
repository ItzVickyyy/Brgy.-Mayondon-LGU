import { createFileRoute } from "@tanstack/react-router"
import {
  CalendarDays,
  Check,
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
import { Fragment, useEffect, useMemo, useState } from "react"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { RowActions } from "@/components/Common/RowActions"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  documentFields,
  documentSections,
  documentTypes,
  historyDocumentTypes,
  documentCardInfo,
  documentMeta,
  normalizeDocumentType,
  type IssuanceRecord,
  sampleIssuances,
} from "@/components/Issuances/config"
import { FormSection, SummaryCard } from "@/components/Issuances/IssuanceLayout"
import { DateField } from "@/components/Issuances/DateField"
import { PrintSummaryPanel } from "@/components/Issuances/PrintSummaryPanel"
import { NewIssuanceDialog } from "@/components/Issuances/NewIssuance/NewIssuanceDialog"
import { documentConfig } from "@/components/Issuances/NewIssuance/documentConfig"
import { getMissingFields } from "@/components/Issuances/print-summary"
import { sampleResidents } from "@/components/Records/records-sample-data"
import { initialOfficials } from "@/components/Officials/officials-sample-data"
import { calculateAge, formatPaperDate, formatPrintedName } from "@/lib/issuance-format"
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
  const [isIssuanceModalOpen, setIsIssuanceModalOpen] = useState(false)
  const [isSimplifiedDialogOpen, setIsSimplifiedDialogOpen] = useState(() => Boolean(getPreselectedResident()))
  const [selectedType, setSelectedType] = useState<string>(documentTypes[0])
  const [residentQuery, setResidentQuery] = useState("")
  const [selectedResidentId, setSelectedResidentId] = useState(() => initialResident?.id ?? "")
  const [manualEntry, setManualEntry] = useState(false)
  const [activeResidentMatch, setActiveResidentMatch] = useState(0)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [formErrorSummary, setFormErrorSummary] = useState<string[]>([])
  const [confirmFormAction, setConfirmFormAction] = useState<"clear" | "discard" | null>(null)
  const [lostDetailsNotice, setLostDetailsNotice] = useState("")
  const [clearanceAdvancedOpen, setClearanceAdvancedOpen] = useState(false)
  const [dateFieldResetKey, setDateFieldResetKey] = useState(0)
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
  const autoSaveStatus = "saved" as const
    const [printRecord, setPrintRecord] = useState<IssuanceRecord | null>(null)
  const [viewRecord, setViewRecord] = useState<IssuanceRecord | null>(null)
  const [notice, setNotice] = useState("")
  const [noticePrintRecord, setNoticePrintRecord] = useState<IssuanceRecord | null>(null)
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
          const matchesType = historyType === "All document types" || normalizeDocumentType(item.type) === normalizeDocumentType(historyType)
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
    if (!query || selectedResidentId) return []
    return sampleResidents.filter((resident) => resident.status === "Active")
      .filter((resident) => [resident.name, resident.id, resident.idNumber, resident.address].some((value) => value.toLowerCase().includes(query)))
      .slice(0, 6)
  }, [residentQuery, selectedResidentId, manualEntry])

  const allFormFields = documentSections[selectedType]?.flatMap((section) => section.fields) ?? []
  const defaultsForDirtyCheck = createDefaultFormValues(selectedType)
  const isDirty = Object.entries(formValues).some(([key, value]) => value.trim() !== (defaultsForDirtyCheck[key] ?? "").trim())
  useEffect(() => {
    if (selectedType !== "Barangay Clearance") {
      setClearanceAdvancedOpen(false)
      return
    }
    const advancedValues = ["purposeNote", "referredBy"].some((key) => Boolean(formValues[key]?.trim()))
      || Boolean(formValues.remarks?.trim() && formValues.remarks !== "NO DEROGATORY RECORD ON FILE")
      || Boolean(validationErrors.purposeNote || validationErrors.remarks || validationErrors.referredBy)
      || formValues.purpose === "Employment Requirement/First Time Jobseeker"
    if (advancedValues) setClearanceAdvancedOpen(true)
  }, [selectedType, formValues.purpose, formValues.purposeNote, formValues.remarks, formValues.referredBy, validationErrors.purposeNote, validationErrors.remarks, validationErrors.referredBy])

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
    setNoticePrintRecord(null)
  }

  function changeDocumentType(value: string) {
    const sharedKeys = ["firstName", "middleName", "lastName", "name", "birthdate", "age", "birthplace", "civilStatus", "address", "residentId", "photoUrl", "date"]
    const previousFields = documentSections[selectedType]?.flatMap((section) => section.fields) ?? []
    const lost = previousFields.some((field) => !sharedKeys.includes(field.name) && field.name !== "date" && Boolean(formValues[field.name]?.trim()) && formValues[field.name] !== (field.defaultValue ?? ""))
    const preserved = Object.fromEntries(sharedKeys.filter((key) => formValues[key]).map((key) => [key, formValues[key]]))
    const defaults = createDefaultFormValues(value)
    const residentRecord = sampleResidents.find((resident) => resident.id === selectedResidentId)
    const name = formValues.firstName || formValues.lastName
      ? formatPrintedName(formValues.firstName ?? "", formValues.middleName ?? "", formValues.lastName ?? "", value)
      : formValues.name ?? ""
    setSelectedType(value)
    setClearanceAdvancedOpen(false)
    setFormValues({
      ...defaults,
      ...preserved,
      name,
      age: calculateAge(formValues.birthdate ?? "", formValues.date ?? defaults.date ?? localDateValue()),
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

    const nextValues = {
      ...formValues,
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
      age: calculateAge(resident.birthdate, formValues.date || localDateValue()),
      photoUrl: resident.photoUrl ?? "",
      residencyDuration: resident.residentSince ? String(Math.max(0, new Date(`${formValues.date || localDateValue()}T00:00:00`).getFullYear() - resident.residentSince)) : "",
      ...(formValues.recipientChoice === "Oneself" ? { underName: name } : {}),
    }
    const firstEmptyRequired = allFormFields.find((field) =>
      field.required
      && (!field.showWhen || field.showWhen(nextValues))
      && !nextValues[field.name]?.trim()
      && !["firstName", "middleName", "lastName"].includes(field.name),
    )
    if (firstEmptyRequired) {
      window.setTimeout(() => {
        const target = document.getElementById("field-" + firstEmptyRequired.name)
        target?.scrollIntoView({ behavior: "smooth", block: "center" })
        target?.focus()
      }, 0)
    }
  }

  function startManualEntry() {
    setDateFieldResetKey((key) => key + 1)
    setSelectedResidentId("")
    
    setResidentQuery("")
    setManualEntry(true)
    setFormValues((previous) => ({
      ...createDefaultFormValues(selectedType),
      date: previous.date || localDateValue(),
    }))
  }

  function performClearForm() {
    setDateFieldResetKey((key) => key + 1)
    setClearanceAdvancedOpen(false)
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

  function saveIssuance(asDraft = false): IssuanceRecord | null {
    if (!formValues.name?.trim()) {
      setValidationErrors({ name: "Name is required." })
      setFormErrorSummary(["name"])
      document.getElementById("field-name")?.focus()
      return null
    }
    if (!asDraft && validateIssuedForm()) return null
    if (continueTarget && !asDraft) {
      const continuedRecord: IssuanceRecord = {
        ...continueTarget,
        resident: currentName,
        date: currentDate,
        status: "Issued",
        purpose: formValues.purpose || continueTarget.purpose,
        fields: { ...formValues },
      }
      setHistoryRecords((previous) => previous.map((item) => item.id === continueTarget.id ? continuedRecord : item))
      setNotice(`${continueTarget.id} was continued and marked as issued.`)
      try {
        window.localStorage.removeItem(AUTO_DRAFT_KEY)
      } catch {
        // The issuance can still be completed if browser storage is blocked.
      }
      setContinueTarget(null)
      setIsIssuanceModalOpen(false)
      return continuedRecord
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
    setNoticePrintRecord(asDraft ? null : record)
    setCorrectionTarget(null)
    setCorrectionReason("")
    setIsIssuanceModalOpen(false)
    return record
  }

  function preparePrint(record?: IssuanceRecord) {
    setNoticePrintRecord(null)
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
    const options = field.name === "referredBy"
      ? ["None", ...initialOfficials.filter((official) => official.status === "Current").flatMap((official) => {
          const title = official.position === "Punong Barangay" ? "Kap." :
            official.position === "Barangay Kagawad" ? "Kag." :
            official.position === "SK Chairperson" ? "SK" :
            official.position === "Administrator" ? "Admin" : ""
          return title ? [`c/o ${title} ${official.name}`] : []
        })]
      : field.name === "tricycleAssociation" ? usedAssociations
      : field.name === "purpose" && selectedType === "Certificate of Indigency" ? usedIndigencyPurposes
      : field.options ?? []
    const wrapperClass = cn(labelClassName, field.span === 3 && "md:col-span-2")
    if (field.type === "date") {
      const year = new Date().getFullYear()
      const isIssueDate = field.name === "idDateOfIssue" || field.name === "ctcDateOfIssue"
      return (
        <div key={field.name} className={wrapperClass} id={`wrap-${field.name}`}>
          <DateField
            key={`${field.name}-${dateFieldResetKey}`}
            id={fieldId}
            label={field.label}
            value={value}
            onChange={(nextValue) => updateField(field.name, nextValue)}
            required={field.required}
            error={error}
            help={field.help}
            minYear={field.name === "birthdate" ? year - 110 : isIssueDate ? year - 15 : year - 1}
            maxYear={field.name === "birthdate" || isIssueDate ? year : year + 1}
            noFuture={field.name === "birthdate" || isIssueDate}
          />
        </div>
      )
    }
    return (
      <div key={field.name} className={wrapperClass} id={`wrap-${field.name}`}>
        <label htmlFor={fieldId}>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</label>
        {field.type === "radio" || field.type === "checkboxes" || field.type === "multiselect" ? (
          <>
            <fieldset className="min-w-0"><legend className="sr-only">{field.label}</legend><div className="flex flex-wrap gap-2">
              {(field.options ?? []).map((option) => {
                const multi = field.type !== "radio"
                const selected = multi ? value.split("||").filter(Boolean).includes(option) : value === option
                const selectedValues = value.split("||").filter(Boolean)
                const limitReached = field.type === "multiselect" && Boolean(field.maxSelected) && selectedValues.length >= (field.maxSelected ?? 0)
                const optionDisabled = Boolean(multi && limitReached && !selected)
                return <label key={option} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-normal focus-within:ring-[3px] focus-within:ring-ring/50", selected ? "border-primary bg-primary/10" : "bg-background hover:bg-muted", optionDisabled && "cursor-not-allowed opacity-50")}>
                  <input id={field.options?.[0] === option ? fieldId : undefined} type={multi ? "checkbox" : "radio"} name={field.name} checked={selected} disabled={optionDisabled} aria-disabled={optionDisabled} onChange={(event) => {
                    if (!multi) updateField(field.name, option)
                    else {
                      const values = value.split("||").filter(Boolean)
                      const next = event.target.checked
                        ? values.length < (field.maxSelected ?? 99) ? [...values, option] : values
                        : values.filter((item) => item !== option)
                      updateField(field.name, next.join("||"))
                    }
                  }} className="size-4 accent-primary" />{option}
                </label>
              })}
            </div></fieldset>
            {field.type === "multiselect" && field.maxSelected ? <p className="text-xs font-normal text-muted-foreground">{value.split("||").filter(Boolean).length} of {field.maxSelected} selected</p> : null}
          </>
        ) : field.type === "select" ? (
          <select id={fieldId} value={value} onChange={(event) => updateField(field.name, event.target.value)} className={cn(inputClassName, error && "border-destructive")} aria-invalid={Boolean(error)}><option value="">Select {field.label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        ) : field.type === "combobox" ? (
          <><input id={fieldId} value={value} onChange={(event) => updateField(field.name, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault() }} list={`list-${field.name}`} className={cn(inputClassName, error && "border-destructive")} aria-invalid={Boolean(error)} /><datalist id={`list-${field.name}`}>{[...(field.options ?? []), ...options].map((option) => <option key={option} value={option} />)}</datalist></>
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
          <input id={fieldId} type={field.type === "number" ? "number" : "text"} value={value} onChange={(event) => updateField(field.name, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault() }} max={field.name.toLowerCase().includes("dateofissue") ? localDateValue() : undefined} min={field.type === "number" ? "0" : undefined} className={cn(inputClassName, error && "border-destructive")} aria-invalid={Boolean(error)} />
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
          onClick={() => setIsSimplifiedDialogOpen(true)}
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
          {noticePrintRecord && notice.includes(noticePrintRecord.id) ? <Button type="button" variant="outline" size="sm" onClick={() => printNow(noticePrintRecord)}><Printer aria-hidden="true" />Print</Button> : null}
          <Button variant="ghost" size="icon" className="size-11" onClick={() => { setNotice(""); setNoticePrintRecord(null) }} aria-label="Dismiss message">
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
        <DialogContent className="print:hidden flex max-h-[96dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl" onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById(initialResident ? "field-purpose" : "resident-search")?.focus() }}>
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
              <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                <div className="min-w-0 space-y-4">
                  <FormSection title="Document" step={1} description="Choose the pre-printed paper that matches the request.">
                    <div className="md:col-span-2 space-y-3">
                      {(["Clearances", "Certifications"] as const).map((group) => (
                        <div key={group} className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {documentTypes.filter((type) => documentMeta[type]?.group === group).map((type) => {
                              const info = documentCardInfo[type]
                              const selected = selectedType === type
                              return (
                                <label key={type} className={cn("flex min-h-[58px] min-w-0 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all focus-within:ring-[3px] focus-within:ring-ring/50", selected ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" : "bg-background hover:border-muted-foreground/40 hover:bg-muted/60")}>
                                  <input type="radio" name="documentType" checked={selected} onChange={() => changeDocumentType(type)} className="size-4 shrink-0 accent-primary" />
                                  <span className="min-w-0 flex-1 break-words font-medium leading-snug">{info.name}</span>
                                  {selected ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">{documentMeta[selectedType]?.hint ?? documentCardInfo[selectedType]?.hint}</p>
                    </div>
                    <div className="md:col-span-2">
                      <DateField
                        key={`document-date-${dateFieldResetKey}`}
                        id="field-date"
                        label="Date on document"
                        value={formValues.date ?? localDateValue()}
                        onChange={(value) => updateField("date", value)}
                        required
                        error={validationErrors.date}
                        minYear={new Date().getFullYear() - 1}
                        maxYear={new Date().getFullYear() + 1}

                      />
                    </div>
                  </FormSection>

                  <FormSection title="Resident" step={2} description="Search the resident record or enter the details manually.">
                    <div className="md:col-span-2">
                      <label htmlFor="resident-search" className="mb-1.5 block text-sm font-medium">Search name or ID number</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input id="resident-search" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(residentQuery.trim() && !selectedResidentId)} aria-controls="resident-results" aria-activedescendant={residentMatches[activeResidentMatch] ? `resident-option-${residentMatches[activeResidentMatch].id}` : undefined} value={residentQuery} onChange={(event) => { setResidentQuery(event.target.value); setActiveResidentMatch(0); setSelectedResidentId("") }} onKeyDown={(event) => {
                          if (event.key === "ArrowDown" && residentMatches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.min(index + 1, residentMatches.length - 1)) }
                          if (event.key === "ArrowUp" && residentMatches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.max(index - 1, 0)) }
                          if (event.key === "Enter" && residentMatches[activeResidentMatch]) { event.preventDefault(); selectResident(residentMatches[activeResidentMatch]) }
                          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setResidentQuery("") }
                        }} placeholder="Search name or ID number…" className={cn(inputClassName, "pl-9")} />
                      </div>
                      {residentQuery.trim() && !selectedResidentId ? (
                        <div id="resident-results" role="listbox" aria-label="Resident search results" className="mt-2 overflow-hidden rounded-xl border bg-card">
                          {residentMatches.length ? residentMatches.map((resident, index) => (
                            <button key={resident.id} type="button" role="option" aria-selected={activeResidentMatch === index} onMouseEnter={() => setActiveResidentMatch(index)} onClick={() => selectResident(resident)} id={`resident-option-${resident.id}`} className={cn("flex min-h-14 w-full flex-col items-start gap-1 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/60", activeResidentMatch === index && "bg-muted")}>
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
                    {((documentSections[selectedType] ?? []).find((section) => section.id === "resident")?.fields ?? []).map((field) => {
                      if (selectedResidentId && ["firstName", "middleName", "lastName"].includes(field.name)) return null
                      if (selectedResidentId && field.name === "name") {
                        return <div key={field.name} className="md:col-span-2">{renderField(field)}</div>
                      }
                      return renderField(field)
                    })}
                  </FormSection>

                  {(documentSections[selectedType] ?? []).filter((section) => !["resident", "receipt"].includes(section.id)).map((section) => {
                    const advancedFields = section.fields.filter((field) => field.advanced)
                    const regularFields = section.fields.filter((field) => !field.advanced)
                    const advancedSummary = [
                      formValues.purposeNote?.trim() ? "Purpose note edited" : "",
                      formValues.remarks?.trim() && formValues.remarks !== "NO DEROGATORY RECORD ON FILE" ? "Remarks edited" : "",
                      formValues.referredBy?.trim() && formValues.referredBy !== "None" ? formValues.referredBy : "",
                    ].filter(Boolean).join(" · ")

                    return (
                      <FormSection key={section.id} title={section.title} step={3} description={section.description}>
                        {section.id === "details" && selectedType === "Barangay Franchise Clearance" ? (
                          <>
                            {regularFields.map((field, index) => (
                              <Fragment key={field.name}>
                                {index === 1 ? <p className="md:col-span-2 text-xs font-medium text-muted-foreground">Vehicle</p> : null}
                                {renderField(field)}
                              </Fragment>
                            ))}
                          </>
                        ) : regularFields.map(renderField)}
                        {advancedFields.length > 0 ? (
                          <details className="md:col-span-2" open={clearanceAdvancedOpen} onToggle={(event) => setClearanceAdvancedOpen(event.currentTarget.open)}>
                            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary underline underline-offset-4">More options (optional){!clearanceAdvancedOpen && advancedSummary ? <span className="ml-2 break-words text-xs font-normal text-muted-foreground">{advancedSummary}</span> : null}</summary>
                            <div className="grid gap-4 md:grid-cols-2">{advancedFields.map(renderField)}</div>
                          </details>
                        ) : null}
                      </FormSection>
                    )
                  })}
                  {(documentSections[selectedType] ?? []).filter((section) => section.id === "receipt").map((section) => (
                    <FormSection key={section.id} title="Identification & receipt" step={4} description="Enter the details from the CTC or identification document.">
                      {section.fields.map(renderField)}
                    </FormSection>
                  ))}
                </div>
                <div className="min-w-0">
                  {(() => {
                    const missing = getMissingFields(selectedType, formValues, allFormFields)
                    const summaryTitle = missing.length ? `Will print · ${missing.length} missing` : "Will print · Ready to issue"
                    return (
                      <>
                        <details className="rounded-xl border bg-card lg:hidden">
                          <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold">{summaryTitle}</summary>
                          <PrintSummaryPanel type={selectedType} values={formValues} currentDate={currentDate} fields={allFormFields} />
                        </details>
                        <div className="hidden rounded-xl border bg-card lg:block">
                          <PrintSummaryPanel type={selectedType} values={formValues} currentDate={currentDate} fields={allFormFields} />
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 border-t bg-card px-4 py-3 sm:flex-row sm:items-center sm:px-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground sm:mr-auto">
                <span className={cn("size-2 rounded-full", autoSaveStatus === "saved" ? "bg-emerald-500" : "animate-pulse bg-amber-500")} />
                {autoSaveStatus === "saved" ? "Draft saved automatically on this device" : "Saving draft…"}
              </div>
              <Button type="button" variant="ghost" size="lg" onClick={clearForm}><Eraser aria-hidden="true" />Clear form</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => saveIssuance(true)}>Save as draft</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => preparePrint()}><Eye aria-hidden="true" />Print preview</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => saveIssuance(false)}><FileCheck2 aria-hidden="true" />Save as issued</Button>
              <Button type="button" size="lg" onClick={() => { const record = saveIssuance(false); if (record) printNow(record) }}><Printer aria-hidden="true" />Save &amp; print</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <NewIssuanceDialog
        open={isSimplifiedDialogOpen}
        onOpenChange={setIsSimplifiedDialogOpen}
        initialResidentId={getPreselectedResident()}
        onSaved={(record) => {
          const resident = sampleResidents.find((item) => item.id === record.residentId)
          const type = documentConfig[record.documentType].name
          const status = record.status === "draft" ? "Pending" : "Issued"
          const purpose = record.payload.purposeText ?? ""
          const fields: Record<string, string> = { purpose }
          if (record.payload.details.type === "BARANGAY_ID") fields.validUntil = record.payload.details.validUntil
          const historyRecord: IssuanceRecord = {
            id: record.referenceNo,
            resident: record.residentSnapshot?.fullName ?? resident?.name ?? "Selected resident",
            type,
            date: record.issueDate,
            status,
            purpose,
            validUntil: record.payload.details.type === "BARANGAY_ID" ? record.payload.details.validUntil : undefined,
            orNumber: record.payload.payment?.officialReceiptNo,
            issuedBy: record.status === "issued" ? "staff" : undefined,
            fields,
          }
          if (record.status === "draft") setDrafts((previous) => [historyRecord, ...previous])
          else setHistoryRecords((previous) => [historyRecord, ...previous])
          setNotice(record.status === "draft" ? `${record.referenceNo} was saved as a draft.` : `${record.referenceNo} was recorded as issued. Printing remains paused.`)
          setNoticePrintRecord(null)
        }}
      />

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
                    {formatPaperDate(viewRecord.date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Purpose</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.purpose || viewRecord.fields.purpose || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valid until</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.validUntil ? formatPaperDate(viewRecord.validUntil) : "—"}</dd>
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
                {historyDocumentTypes.map((type) => (
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
