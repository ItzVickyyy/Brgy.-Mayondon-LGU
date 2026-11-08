import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, CircleAlert, CheckCircle2, Clock, Keyboard, Printer, Search } from "lucide-react"
import { useNewIssuanceForm, defaultDetails, localIsoDate } from "./useNewIssuanceForm"
import { documentConfig, type DetailFieldConfig, type DocumentCode } from "./documentConfig"
import { signatoryRules } from "./schemas"
import { useQuery } from "@tanstack/react-query"
import { getMissingResidentFields, getResidentAddress, issuanceApi, PHOTO_ON_FILE, type MockIssuance, type QuickResidentInput, type ResidentPatch } from "./issuanceApi"
import type { ResidentRecord } from "@/components/Records/records-sample-data"
import { calculateAge, formatPrintedName } from "@/lib/issuance-format"
import { formControlClass } from "@/components/Common/formStyles"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { PrintSummaryPanel } from "@/components/Issuances/PrintSummaryPanel"
import { CheckField, ChoiceRow, ComboField, SelectField } from "./FormControls"
import { DateField } from "./DateField"
import { popoverIsOpen } from "./popover"
import { IssuanceSection } from "./IssuanceSection"
import { DocumentTypePicker } from "./DocumentTypePicker"
import { PhotoCapture } from "./PhotoCapture"
import { useTranslation } from "react-i18next"
import { documentName, fieldHelp, fieldLabel, fieldOptionLabel, validationMessage } from "@/lib/issuanceLabels"
import { getLocaleOr } from "@/lib/locale"
import { civilStatusLabel, sexLabel } from "@/lib/residentLabels"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialResidentId?: string
  /** When set together with initialResidentId (or alone), the dialog opens on this document type. */
  initialDocumentType?: DocumentCode
  initialDraftId?: string
  /** Called for every save. `meta.auto` is true for the quiet automatic draft saves. */
  onSaved: (record: MockIssuance, meta?: { auto: boolean }) => void
  /** Called when a draft is deleted (discarded, or turned into an issued document). */
  onDraftRemoved?: (id: string) => void
  /** Called when the person asks to print an issued document. */
  onPrint?: (record: MockIssuance) => Promise<string | void> | string | void
}

type CurrentOfficial = { id: string; name: string; position: string; status: "Current" }
// The officials come from the server. Helpers outside the component read this copy, which the component refreshes on every render.
let currentOfficials: CurrentOfficial[] = []
const signatoryPositions = ["Punong Barangay", "Barangay Kagawad", "Barangay Clerk", "Administrative Assistant", "SK Chairperson", "OIC Kagawad"]
const printedNameType: Record<DocumentCode, string> = {
  BARANGAY_CLEARANCE: "Barangay Clearance",
  FRANCHISE_CLEARANCE: "Barangay Franchise Clearance",
  UTILITY_CLEARANCE: "Barangay Clearance, Electrical and Water Connection",
  RESIDENCY: "Certification of Residency",
  INDIGENCY: "Certificate of Indigency",
  ASSISTANCE: "Certification (assistance request)",
  MARGINALIZED_SECTOR: "Marginalized Sector Certification (Pagpapatunay)",
  FIRST_TIME_JOBSEEKER: "First-Time Jobseeker Certification",
  BARANGAY_ID: "Barangay ID",
}
const stampDocuments: DocumentCode[] = ["BARANGAY_CLEARANCE", "FRANCHISE_CLEARANCE", "UTILITY_CLEARANCE"]
const identityDocuments: DocumentCode[] = stampDocuments
type PaymentKey = "officialReceiptNo" | "isFree" | "dateOfPayment" | "certifiedBy"
const paymentKeyOf = (fieldName: string): PaymentKey => (fieldName === "isFree" || fieldName === "dateOfPayment" || fieldName === "certifiedBy" ? fieldName : "officialReceiptNo")
const nameExtensions = ["None", "Jr.", "Sr.", "II", "III", "IV", "V"]
const civilStatusChoices = ["Single", "Married", "Legally Separated", "Widow/Widower"]
const purokNumbers = [1, 2, 3, 4, 5, 6]
const fieldLabelClass = "flex min-w-0 flex-col gap-1.5 text-sm font-medium"

function normalizedOptionValue(fieldName: string, option: string) {
  if (fieldName === "witnessOfficialId") return currentOfficials.find((official) => official.status === "Current" && official.name === option)?.id ?? option
  if (fieldName === "services" || fieldName === "connectionType" || fieldName === "classification" || fieldName === "assistanceType" || fieldName === "transactionType") return option.toLowerCase()
  if (fieldName === "isJobstartBeneficiary") return option === "Yes" ? "true" : "false"
  if (fieldName === "parts") return ({ "Applicant sheet": "applicant_sheet", Oath: "oath", Certification: "certification" } as Record<string, string>)[option] ?? option
  return option
}

const emptyQuickAdd: QuickResidentInput = {
  lastName: "", firstName: "", middleName: "", suffix: "", birthdate: "", birthplace: "", sex: "", civilStatus: "Single",
  houseNumber: "", street: "", purok: 1, residentSinceBirth: false,
}

function getDefaultToday(value: unknown) {
  return value === "today" ? localIsoDate() : typeof value === "string" ? value : ""
}

export function NewIssuanceDialog({ open, onOpenChange, initialResidentId, initialDocumentType, initialDraftId, onSaved, onDraftRemoved, onPrint }: Props) {
  const { t } = useTranslation()
  const purokChoices = purokNumbers.map((purok) => ({ value: String(purok), label: t("issuances.new.resident.purokN", { n: purok }) }))
  const nameExtensionOptions = nameExtensions.map((extension) => ({ value: extension, label: extension === "None" ? t("issuances.new.resident.none") : extension }))
  const civilStatusOptions = civilStatusChoices.map((status) => ({ value: status, label: civilStatusLabel(status, t) }))
  const form = useNewIssuanceForm(initialResidentId ?? "")
  const lookupsQuery = useQuery({ queryKey: ["issuance-lookups"], queryFn: () => issuanceApi.getLookups(), enabled: open, staleTime: 60_000 })
  const officialsQuery = useQuery({ queryKey: ["issuance-officials"], queryFn: () => issuanceApi.getOfficials(), enabled: open, staleTime: 60_000 })
  currentOfficials = (officialsQuery.data ?? []).map((official) => ({ ...official, status: "Current" as const }))
  const availableSignatories = currentOfficials.filter((official) => signatoryPositions.includes(official.position))
  signatoryRules.available = availableSignatories.length > 0
  const knownStreets = lookupsQuery.data?.streets ?? []
  const knownAssociations = lookupsQuery.data?.associations ?? []
  const [residents, setResidents] = useState<ResidentRecord[]>([])
  const [residentQuery, setResidentQuery] = useState("")
  // Server search state: which query the list in `residents` answers, and whether a search is running or failed.
  const [searchedQuery, setSearchedQuery] = useState("")
  const [searchFailed, setSearchFailed] = useState(false)
  const [activeResidentMatch, setActiveResidentMatch] = useState(0)
  const [selectedResident, setSelectedResident] = useState<ResidentRecord | null>(null)
  const [quickAdd, setQuickAdd] = useState<QuickResidentInput>(emptyQuickAdd)
  const [residentUpdates, setResidentUpdates] = useState<ResidentPatch>({})
  const [selectedSector, setSelectedSector] = useState<string | string[]>("")
  const [sectorManuallySelected, setSectorManuallySelected] = useState(false)
  const [pendingDocumentType, setPendingDocumentType] = useState<DocumentCode | null>(null)
  const [validUntilEdited, setValidUntilEdited] = useState(false)
  const [addressParts, setAddressParts] = useState(() => ({ houseNumber: selectedResident?.houseNumber ?? "", street: selectedResident?.street ?? "", purok: selectedResident?.purok ?? 1 }))
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successRecord, setSuccessRecord] = useState<MockIssuance | null>(null)
  const [duplicate, setDuplicate] = useState<{ referenceNo: string; issueDate: string } | null>(null)
  const [formError, setFormError] = useState("")
  const [discardOpen, setDiscardOpen] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [quickAttempted, setQuickAttempted] = useState(false)
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickDuplicateSignature, setQuickDuplicateSignature] = useState<string | null>(null)
  const [editingResident, setEditingResident] = useState(false)
  const [printNotice, setPrintNotice] = useState("")
  const [autoSave, setAutoSave] = useState<{ state: "idle" | "saving" | "saved" | "error"; at?: Date }>({ state: "idle" })
  const draftIdRef = useRef<string | null>(null)
  const restoredDraftRef = useRef("")
  const correctionDraftRef = useRef(false)
  const lastSavedRef = useRef("")
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())
  const documentType = form.watch("documentType")
  const issueDate = form.watch("issueDate")
  const details = form.watch("details")
  const identification = form.watch("identification")
  const payment = form.watch("payment")
  const config = documentConfig[documentType]
  // Read during render so react-hook-form keeps isDirty up to date for the discard prompt.
  const formDirty = form.formState.isDirty
  const allResidents = useMemo(() => residents, [residents])
  const trimmedQuery = residentQuery.trim()
  // The server does the matching; show its answer only while it still belongs to what is typed.
  const matches = useMemo(() => {
    if (!trimmedQuery || selectedResident || searchedQuery !== trimmedQuery) return []
    return allResidents.slice(0, 8)
  }, [allResidents, trimmedQuery, searchedQuery, selectedResident])
  const searching = Boolean(trimmedQuery) && !selectedResident && searchedQuery !== trimmedQuery && !searchFailed

  useEffect(() => {
    if (!open || selectedResident || !trimmedQuery) { setSearchFailed(false); return }
    let cancelled = false
    setSearchFailed(false)
    const timer = window.setTimeout(() => {
      issuanceApi.searchResidents(trimmedQuery).then((found) => {
        if (cancelled) return
        setResidents(found)
        setSearchedQuery(trimmedQuery)
      }).catch(() => {
        if (!cancelled) setSearchFailed(true)
      })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, selectedResident, trimmedQuery])

  function prefillResidentSector(code: DocumentCode, resident: ResidentRecord) {
    const sectorField = documentConfig[code].fields.find((field) => field.name === "sector")
    if (!sectorField) {
      setSelectedSector("")
      form.setValue("sectors", [], { shouldDirty: false })
      return
    }
    const options = sectorField.options ?? []
    const matching = resident.sectors.filter((sector) => options.includes(sector)).slice(0, sectorField.maxSelected ?? 1)
    setSelectedSector(sectorField.type === "multiselect" ? matching : matching[0] ?? "")
    form.setValue("sectors", matching.map((sector) => ({ sectorId: options.indexOf(sector) + 1 })), { shouldDirty: false })
  }

  function changeDocumentType(nextCode: DocumentCode) {
    const current = form.getValues()
    const detailsDirty = Object.entries(current.details as unknown as Record<string, unknown>).some(([key, value]) => {
      const defaults = defaultDetails(current.documentType) as unknown as Record<string, unknown>
      return JSON.stringify(value) !== JSON.stringify(defaults[key])
    }) || Boolean(current.purposeText?.trim()) || Boolean(current.identification?.idNumber?.trim()) || Boolean(current.payment?.officialReceiptNo?.trim()) || sectorManuallySelected
    if (detailsDirty) { setPendingDocumentType(nextCode); return }
    applyDocumentType(nextCode)
  }

  function applyDocumentType(nextCode: DocumentCode) {
    const current = form.getValues()
    form.setValue("documentType", nextCode, { shouldDirty: true })
    const nextDetails = defaultDetails(nextCode)
    if (nextCode === "BARANGAY_ID" && nextDetails.type === "BARANGAY_ID") {
      const baseDate = new Date(`${current.issueDate}T00:00:00`)
      baseDate.setFullYear(baseDate.getFullYear() + 1)
      nextDetails.validUntil = localIsoDate(baseDate)
    }
    form.setValue("details", nextDetails, { shouldDirty: true })
    form.setValue("purposeText", "")
    form.setValue("remarks", nextCode === "BARANGAY_CLEARANCE" ? "NO DEROGATORY RECORD ON FILE" : "")
    form.setValue("identification", identityDocuments.includes(nextCode)
      ? { idTypeId: nextCode === "BARANGAY_CLEARANCE" ? 0 : 1, idNumber: "", placeOfIssue: "Los Baños, Laguna", dateOfIssue: localIsoDate() }
      : undefined)
    form.setValue("payment", stampDocuments.includes(nextCode)
      ? { officialReceiptNo: "", isFree: false, dateOfPayment: localIsoDate(), certifiedBy: "" }
      : identityDocuments.includes(nextCode) ? { officialReceiptNo: "", isFree: false } : undefined)
    const signatoryDefault = documentConfig[nextCode].signatoryDefault
    const signatory = signatoryDefault ? currentOfficials.find((official) => official.status === "Current" && official.position === signatoryDefault) : undefined
    form.setValue("signatoryOfficialId", signatory?.id)
    form.clearErrors()
    setSelectedSector("")
    setSectorManuallySelected(false)
    if (selectedResident) prefillResidentSector(nextCode, selectedResident)
    setValidUntilEdited(false)
    setDuplicate(null)
    setFormError("")
  }

  function selectResident(resident: ResidentRecord, code: DocumentCode = documentType) {
    if (resident.status === "Archived") return
    setSelectedResident(resident)
    setEditingResident(false)
    setResidentQuery("")
    form.setValue("residentId", resident.id, { shouldDirty: true })
    setResidentUpdates({})
    setAddressParts({ houseNumber: resident.houseNumber ?? "", street: resident.street ?? "", purok: resident.purok ?? 1 })
    prefillResidentSector(code, resident)
    setSectorManuallySelected(false)
    setDuplicate(null)
    setFormError("")
  }

  // Opened from another page (for example an ID row in Records Management): select the resident and document type once per open.
  const appliedInitialRef = useRef("")
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per open for the given resident and type
  useEffect(() => {
    if (!open) { appliedInitialRef.current = ""; return }
    const key = `${initialResidentId ?? ""}|${initialDocumentType ?? ""}`
    if (key === "|" || appliedInitialRef.current === key) return
    appliedInitialRef.current = key
    if (initialDocumentType && initialDocumentType !== form.getValues("documentType")) applyDocumentType(initialDocumentType)
    if (initialResidentId) void issuanceApi.fetchResident(initialResidentId).then((resident) => { if (resident) selectResident(resident, initialDocumentType) })
  }, [open, initialResidentId, initialDocumentType])

  // The picture is a separate request. Until it arrives the resident carries a marker so "photo on file" counts.
  const selectedResidentId = selectedResident?.id
  const selectedPhoto = selectedResident?.photoUrl
  useEffect(() => {
    if (!selectedResidentId || selectedPhoto !== PHOTO_ON_FILE) return
    let active = true
    void issuanceApi.loadResidentPhoto(selectedResidentId).then((url) => {
      if (active && url) setSelectedResident((current) => current && current.id === selectedResidentId ? { ...current, photoUrl: url } : current)
    })
    return () => { active = false }
  }, [selectedResidentId, selectedPhoto])

  function setDetail(name: string, value: unknown) {
    const current = form.getValues("details") as unknown as Record<string, unknown>
    form.setValue("details", { ...current, [name]: value } as never, { shouldDirty: true })
  }

  function setRootField(name: "purposeText" | "remarks", value: string) {
    form.setValue(name, value, { shouldDirty: true })
  }

  function setIdentity(name: "idTypeId" | "idNumber" | "placeOfIssue" | "dateOfIssue", value: string | number) {
    const current = form.getValues("identification") ?? { idTypeId: 1, idNumber: "", placeOfIssue: "Los Baños, Laguna", dateOfIssue: localIsoDate() }
    form.setValue("identification", { ...current, [name]: value } as never, { shouldDirty: true })
  }

  function setPayment(name: PaymentKey, value: string | boolean) {
    const current = form.getValues("payment") ?? { officialReceiptNo: "", isFree: false }
    const next = { ...current, [name]: value }
    if (name === "isFree" && value === true) next.officialReceiptNo = "FOC"
    if (name === "isFree" && value === false && next.officialReceiptNo === "FOC") next.officialReceiptNo = ""
    form.setValue("payment", next as never, { shouldDirty: true })
  }

  function readErrorMessage(node: unknown): string {
    if (typeof node !== "object" || node === null || !("message" in node)) return ""
    const message = (node as { message?: unknown }).message
    return typeof message === "string" ? validationMessage(message, t) : ""
  }

  function getFieldError(field: DetailFieldConfig): string {
    const errors = form.formState.errors as unknown as Record<string, unknown>
    if (field.group === "identity") {
      const key = field.name === "idType" ? "idTypeId" : field.name === "idNumber" ? "idNumber" : field.name === "idPlaceOfIssue" ? "placeOfIssue" : "dateOfIssue"
      return readErrorMessage((errors.identification as Record<string, unknown> | undefined)?.[key])
    }
    if (field.group === "payment") {
      const key = paymentKeyOf(field.name)
      return readErrorMessage((errors.payment as Record<string, unknown> | undefined)?.[key])
    }
    if (field.name === "purpose") return readErrorMessage(errors.purposeText)
    if (field.name === "sector") return readErrorMessage(errors.sectors)
    const key = field.name === "relationship" ? "beneficiaryRelationship" : field.name
    return readErrorMessage((errors.details as Record<string, unknown> | undefined)?.[key])
  }

  function renderField(field: DetailFieldConfig) {
    const fieldId = `issuance-${field.name}`
    const fieldError = getFieldError(field)
    const fieldValue = field.group === "identity"
      ? (identification as unknown as Record<string, unknown> | undefined)?.[field.name === "idType" ? "idTypeId" : field.name === "idNumber" ? "idNumber" : field.name === "idPlaceOfIssue" ? "placeOfIssue" : "dateOfIssue"]
      : field.group === "payment"
        ? (payment as unknown as Record<string, unknown> | undefined)?.[paymentKeyOf(field.name)]
        : field.name === "purpose" ? form.watch("purposeText")
        : field.name === "remarks" ? form.watch("remarks")
        : field.name === "idNumber" && documentType === "BARANGAY_ID" ? String((details as unknown as Record<string, unknown>).idNumber ?? selectedResident?.idNumber ?? "")
        : field.name === "sector" ? selectedSector
        : field.name === "for" ? ((details as unknown as Record<string, unknown>).forSelf === false ? "Someone else" : "Myself")
        : field.name === "relationship" ? (details as unknown as Record<string, unknown>).beneficiaryRelationship
        : field.name === "sectorIdNumber" ? form.watch("sectors")?.[0]?.idNumber ?? ""
        : (details as unknown as Record<string, unknown>)[field.name]
    // idTypeId is stored as a number (lookup id) but the <select> options are ID names, so translate it back for display.
    const idTypeLabel = field.group === "identity" && field.name === "idType" ? (field.options ?? [])[Number(fieldValue ?? 0) - 1] ?? "" : undefined
    const value = idTypeLabel ?? fieldValue ?? getDefaultToday(field.default)
    if (field.showWhen && !field.showWhen({ ...(details as unknown as Record<string, unknown>), for: (details as unknown as Record<string, unknown>).forSelf === false ? "Someone else" : "Myself" })) return null
    const onValueChange = (nextValue: string | boolean) => {
      if (field.group === "identity") {
        if (field.name === "idType") setIdentity("idTypeId", Math.max(1, (field.options ?? []).indexOf(String(nextValue)) + 1))
        else if (field.name === "idNumber") setIdentity("idNumber", String(nextValue))
        else if (field.name === "idPlaceOfIssue") setIdentity("placeOfIssue", String(nextValue))
        else setIdentity("dateOfIssue", String(nextValue))
      } else if (field.group === "payment") {
        setPayment(paymentKeyOf(field.name), nextValue)
      } else if (field.name === "purpose") setRootField("purposeText", String(nextValue))
      else if (field.name === "remarks") setRootField("remarks", String(nextValue))
      else if (field.name === "sector" && field.type === "multiselect") { const values = Array.isArray(nextValue) ? nextValue as string[] : []; setSectorManuallySelected(true); setSelectedSector(values); form.setValue("sectors", values.map((sector) => ({ sectorId: Math.max(1, (field.options ?? []).indexOf(sector) + 1) })), { shouldDirty: true }) }
      else if (field.name === "sector") { setSectorManuallySelected(true); setSelectedSector(String(nextValue)); form.setValue("sectors", [{ sectorId: Math.max(1, (field.options ?? []).indexOf(String(nextValue)) + 1) }], { shouldDirty: true }) }
      else if (field.name === "for") setDetail("forSelf", nextValue === "Myself")
      else if (field.name === "relationship") setDetail("beneficiaryRelationship", String(nextValue))
      else if (field.name === "isJobstartBeneficiary") setDetail(field.name, nextValue === "true")
      else if (["services", "connectionType", "classification", "assistanceType", "transactionType"].includes(field.name)) {
        setDetail(field.name, Array.isArray(nextValue) ? nextValue : String(nextValue).toLowerCase())
      } else if (field.name === "sectorIdNumber") {
        form.setValue("sectors", [{ sectorId: form.getValues("sectors")?.[0]?.sectorId ?? 1, idNumber: String(nextValue) }], { shouldDirty: true })
      } else if (field.name === "validUntil") { setValidUntilEdited(true); setDetail(field.name, nextValue) }
      else setDetail(field.name, nextValue)
    }
    const fieldOptions = field.name === "associationName" ? knownAssociations : field.name === "witnessOfficialId" ? currentOfficials.filter((official) => official.status === "Current").map((official) => official.name) : field.options ?? []
    const missingNow = attempted && Boolean(field.required) && !fieldHasValue(field)
    const invalid = Boolean(fieldError) || missingNow
    const describedBy = fieldError || missingNow ? `${fieldId}-error` : undefined
    const labelText = <>{fieldLabel(field.label, t)}{field.required ? <span className="text-destructive"> *</span> : null}</>
    const message = fieldError || (missingNow ? t("issuances.new.detailsStep.fillIn") : "")
    const messageNode = message ? <span id={`${fieldId}-error`} className="text-xs font-normal text-destructive" role="alert">{message}</span> : null
    if (field.type === "checkbox") {
      return <div key={field.name} className="flex min-h-11 items-center">
        <CheckField id={fieldId} checked={Boolean(value)} onChange={(checked) => onValueChange(checked)} label={fieldLabel(field.label, t)} invalid={invalid} describedBy={describedBy} />
      </div>
    }
    let control: ReactNode
    if (field.type === "combobox") {
      control = <ComboField id={fieldId} value={String(value)} onChange={onValueChange as (next: string) => void} options={fieldOptions} invalid={invalid} describedBy={describedBy} />
    } else if (field.type === "select" || field.type === "radio") {
      control = <SelectField id={fieldId} value={String(value)} onChange={onValueChange as (next: string) => void} options={fieldOptions.map((option) => ({ value: normalizedOptionValue(field.name, option), label: fieldOptionLabel(field.name, option, t) }))} invalid={invalid} describedBy={describedBy} />
    } else if (field.type === "multiselect") {
      const current = Array.isArray(value) ? value as string[] : []
      control = <fieldset aria-labelledby={`${fieldId}-label`} className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
        {(field.options ?? []).map((option) => {
          const optionKey = normalizedOptionValue(field.name, option)
          const checked = current.includes(optionKey)
          return <CheckField key={option} variant="box" id={option === field.options?.[0] ? fieldId : undefined} label={fieldOptionLabel(field.name, option, t)} checked={checked} disabled={Boolean(field.maxSelected && current.length >= field.maxSelected && !checked)} invalid={invalid} describedBy={describedBy} onChange={(next) => onValueChange(next ? [...current, optionKey] as unknown as string : current.filter((item) => item !== optionKey) as unknown as string)} />
        })}
      </fieldset>
    } else if (field.type === "textarea") {
      control = <textarea id={fieldId} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, invalid && "border-destructive", "h-auto py-2")} aria-invalid={invalid} aria-describedby={describedBy} rows={2} />
    } else if (field.type === "date") {
      control = <DateField id={fieldId} value={String(value)} max={field.group === "identity" || field.group === "payment" ? localIsoDate() : undefined} onChange={onValueChange as (next: string) => void} invalid={invalid} describedBy={describedBy} />
    } else {
      control = <input id={fieldId} type={field.type === "number" ? "number" : "text"} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, invalid && "border-destructive")} aria-invalid={invalid} aria-describedby={describedBy} disabled={field.name === "officialReceiptNo" && Boolean(payment?.isFree)} />
    }
    return <div key={field.name} className={fieldLabelClass}>
      {field.type === "multiselect" ? <span id={`${fieldId}-label`}>{labelText}</span> : <label htmlFor={fieldId}>{labelText}</label>}
      {control}
      {messageNode}
      {field.help ? <span className="text-xs font-normal text-muted-foreground">{fieldHelp(field.help, t)}</span> : null}
    </div>
  }

  // Everything that goes into a draft. Resident edits are left out of the quiet
  // automatic saves, so half-typed text never overwrites the resident's record.
  function draftPayload(withResidentUpdates: boolean) {
    return {
      ...form.getValues(),
      residentId: selectedResident?.id ?? "",
      ...(withResidentUpdates ? { residentUpdates } : {}),
      status: "draft" as const,
    }
  }

  const draftSignature = JSON.stringify([form.watch(), selectedResident?.id ?? ""])

  /** Saves the draft. Saves are queued, so two saves can never overlap. */
  function persistDraft(auto: boolean) {
    const run = async () => {
      if (!selectedResident) return null
      const signature = draftSignature
      setAutoSave((previous) => ({ ...previous, state: "saving" }))
      try {
        const payload = draftPayload(!auto)
        const record = draftIdRef.current
          ? await issuanceApi.updateDraft(draftIdRef.current, payload)
          : await issuanceApi.createIssuance(payload)
        draftIdRef.current = record.id
        lastSavedRef.current = signature
        onSaved(record, { auto })
        setAutoSave({ state: "saved", at: new Date() })
        return record
      } catch (error) {
        setAutoSave({ state: "error" })
        if (!auto) setFormError(error instanceof Error ? error.message : t("issuances.new.errors.saveDraft"))
        return null
      }
    }
    const next = saveChain.current.then(run, run)
    saveChain.current = next
    return next as Promise<MockIssuance | null>
  }

  // Restore a server-side draft selected from Issuance History.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore once when the selected draft changes.
  useEffect(() => {
    if (!open || !initialDraftId || draftIdRef.current === initialDraftId) return
    let active = true
    setSaving(true)
    setFormError("")
    void (async () => {
      const record = await issuanceApi.getIssuance(initialDraftId)
      if (!active) return
      if (!record || record.status !== "draft") {
        setFormError(t("issuances.new.errors.draftGone"))
        setSaving(false)
        return
      }
      const resident = await issuanceApi.fetchResident(record.residentId)
      if (!active) return
      if (!resident) {
        setFormError(t("issuances.new.errors.residentLoad"))
        setSaving(false)
        return
      }
      const positions = await issuanceApi.toFormPositions(record.documentType, record.payload)
      const tricycle = record.documentType === "FRANCHISE_CLEARANCE"
        ? await issuanceApi.getTricycle((record.payload.details as { tricycleId?: string }).tricycleId)
        : undefined
      if (!active) return
      const restored = {
        ...record.payload,
        identification: record.payload.identification ? { ...record.payload.identification, idTypeId: positions.idTypePosition } : undefined,
        sectors: positions.sectors,
        purposeText: issuanceApi.getPurposeLabel(record.payload.purposeId) ?? "",
        residentId: record.residentId,
        status: "draft" as const,
        details: tricycle
          ? { ...record.payload.details, ...tricycle }
          : record.documentType === "FIRST_TIME_JOBSEEKER"
            ? { ...record.payload.details, parts: ["applicant_sheet", "oath", "certification"] }
            : record.payload.details,
      }
      form.reset(restored as never)
      setSelectedResident(resident)
      setAddressParts({ houseNumber: resident.houseNumber ?? "", street: resident.street ?? "", purok: resident.purok ?? 1 })
      setResidentUpdates({})
      setEditingResident(false)
      const sectorField = documentConfig[record.documentType].fields.find((field) => field.name === "sector")
      const selected = positions.sectorNames
      setSelectedSector(sectorField?.type === "multiselect" ? selected : selected[0] ?? "")
      setSectorManuallySelected(false)
      setValidUntilEdited(true)
      draftIdRef.current = record.id
      correctionDraftRef.current = Boolean(record.correctsIssuanceId)
      lastSavedRef.current = ""
      setAutoSave({ state: "saved", at: new Date() })
      setSaving(false)
    })().catch((error) => {
      if (!active) return
      setFormError(error instanceof Error ? error.message : t("issuances.new.errors.draftOpen"))
      setSaving(false)
    })
    return () => { active = false }
  }, [open, initialDraftId])

  useEffect(() => {
    if (!open || !initialDraftId || !selectedResident || draftIdRef.current !== initialDraftId || restoredDraftRef.current === initialDraftId) return
    lastSavedRef.current = draftSignature
    restoredDraftRef.current = initialDraftId
  }, [open, initialDraftId, selectedResident, draftSignature])
  // Save quietly a moment after the person stops typing. persistDraft reads the latest values through draftSignature.
  // biome-ignore lint/correctness/useExhaustiveDependencies: draftSignature already covers every form value
  useEffect(() => {
    if (!open || successRecord || saving || !selectedResident || !formDirty) return
    if (draftSignature === lastSavedRef.current) return
    const timer = window.setTimeout(() => { void persistDraft(true) }, 1500)
    return () => window.clearTimeout(timer)
  }, [draftSignature, open, successRecord, saving, selectedResident, formDirty])

  async function removeDraft() {
    await saveChain.current
    const id = draftIdRef.current
    if (!id) return
    draftIdRef.current = null
    await issuanceApi.deleteDraft(id)
    onDraftRemoved?.(id)
  }

  async function saveDraft() {
    if (!selectedResident) {
      setFormError(t("issuances.new.errors.selectResidentDraft"))
      return
    }
    setSaving(true)
    try {
      const record = await persistDraft(false)
      if (!record) return
      onOpenChange(false)
      resetDialog()
    } finally {
      setSaving(false)
    }
  }

  async function issue(andPrint = false) {
    if (!selectedResident) {
      setFormError(t("issuances.new.errors.selectResidentIssue"))
      return
    }
    const projectedResident = { ...selectedResident, ...residentUpdates } as ResidentRecord
    const missingResidentFields = getMissingResidentFields(projectedResident, documentType)
    if (missingResidentFields.length) {
      setAttempted(true)
      const onlyPhoto = missingResidentFields.every((need) => need === "photo")
      setFormError(onlyPhoto ? t("issuances.new.errors.photoFirst") : t("issuances.new.errors.fillMissing"))
      const firstMissing = missingResidentFields[0]
      window.setTimeout(() => {
        const targetId = firstMissing === "address" ? "resident-missing-address-houseNumber" : `resident-missing-${firstMissing}`
        const target = document.getElementById(targetId)
        target?.scrollIntoView({ behavior: "smooth", block: "center" })
        target?.focus()
      }, 0)
      return
    }
    if (missingPreviewLabels.length) {
      setAttempted(true)
      setFormError(missingPreviewLabels.length === 1 ? t("issuances.new.errors.almostThereOne") : t("issuances.new.errors.almostThere", { count: missingPreviewLabels.length }))
      goToFirstMissing()
      return
    }
    setSaving(true)
    setFormError("")
    try {
      // A correction draft may replace its linked original. The API still checks for any other issued copy.
      const check = correctionDraftRef.current
        ? { existingIssued: undefined }
        : await issuanceApi.checkIssuance(selectedResident.id, documentType)
      if (check.existingIssued) {
        setDuplicate(check.existingIssued)
        setSaving(false)
        return
      }
      const raw = { ...form.getValues(), residentId: selectedResident.id, residentUpdates, status: "issued" as const }
      form.setValue("status", "issued", { shouldDirty: false })
      const parsed = form.trigger()
      const valid = await parsed
      if (!valid) {
        setFormError(t("issuances.new.errors.checkRequired"))
        const firstMissing = config.fields.find((field) => fieldVisible(field) && field.required && !fieldHasValue(field))
        if (firstMissing) {
          const target = document.getElementById(`issuance-${firstMissing.name}`)
          target?.scrollIntoView({ behavior: "smooth", block: "center" })
          target?.focus()
        }
        setSaving(false)
        return
      }
      const existingDraftId = draftIdRef.current
      const record = existingDraftId
        ? await issuanceApi.issueDraft(existingDraftId, raw)
        : await issuanceApi.createIssuance(raw)
      // Issue an existing draft in place so a correction keeps its original-document link.
      if (existingDraftId) {
        draftIdRef.current = null
        onDraftRemoved?.(existingDraftId)
      } else {
        await removeDraft()
      }
      setSuccessRecord(record)
      setPrintNotice("")
      onSaved(record)
      if (andPrint) handlePrint(record)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("issuances.new.errors.issue"))
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint(record: MockIssuance) {
    setPrintNotice("")
    const message = await onPrint?.(record)
    setPrintNotice(message || "")
  }

  function hasTypedValues() {
    return formDirty || Boolean(residentQuery.trim()) || Object.keys(residentUpdates).length > 0 ||
      quickAddHasValues()
  }

  function requestClose(nextOpen: boolean) {
    if (!nextOpen && !successRecord && hasTypedValues()) { setDiscardOpen(true); return }
    if (!nextOpen) resetDialog()
    onOpenChange(nextOpen)
  }

  async function discardAndClose() {
    await removeDraft()
    resetDialog()
    onOpenChange(false)
  }

  /** Close now. The automatic draft stays in the list so the work is not lost. */
  async function closeKeepingDraft() {
    if (selectedResident && draftSignature !== lastSavedRef.current) await persistDraft(true)
    await saveChain.current
    resetDialog()
    onOpenChange(false)
  }

  function resetDialog() {
    form.reset()
    setSelectedResident(null)
    setEditingResident(false)
    setResidentQuery("")
    setSearchedQuery("")
    setSearchFailed(false)
    setResidentUpdates({})
    setSelectedSector("")
    setSectorManuallySelected(false)
    setPendingDocumentType(null)
    setAddressParts({ houseNumber: "", street: "", purok: 1 })
    setValidUntilEdited(false)
    setPreviewOpen(false)
    setSuccessRecord(null)
    setDuplicate(null)
    setFormError("")
    setAttempted(false)
    setQuickAttempted(false)
    setQuickDuplicateSignature(null)
    setEditingResident(false)
    setPrintNotice("")
    setDiscardOpen(false)
    setQuickAdd(emptyQuickAdd)
    draftIdRef.current = null
    restoredDraftRef.current = ""
    correctionDraftRef.current = false
    lastSavedRef.current = ""
    saveChain.current = Promise.resolve()
    setAutoSave({ state: "idle" })
  }

  const birthplaceRequired = config.residentNeeds.includes("birthPlace")
  const sexRequired = config.residentNeeds.includes("sex")
  function quickAddHasValues() {
    return Boolean(quickAdd.firstName.trim() || quickAdd.middleName?.trim() || quickAdd.lastName.trim() || quickAdd.suffix?.trim() || quickAdd.birthdate || (quickAdd.birthplace ?? "").trim() || quickAdd.sex || quickAdd.photoUrl || quickAdd.civilStatus !== "Single" || (quickAdd.houseNumber ?? "").trim() || quickAdd.street.trim() || quickAdd.purok !== 1 || quickAdd.residentSinceYear != null || quickAdd.residentSinceBirth)
  }
  const quickMissing = {
    firstName: !quickAdd.firstName.trim(),
    lastName: !quickAdd.lastName.trim(),
    birthdate: !quickAdd.birthdate,
    birthplace: birthplaceRequired && !(quickAdd.birthplace ?? "").trim(),
    sex: sexRequired && !quickAdd.sex,
    houseNumber: !(quickAdd.houseNumber ?? "").trim(),
    street: !quickAdd.street.trim(),
  }

  async function createResident(confirmDuplicate = false) {
    const firstMissing = (Object.keys(quickMissing) as (keyof typeof quickMissing)[]).find((key) => quickMissing[key])
    if (firstMissing) {
      setQuickAttempted(true)
      setFormError("")
      const target = document.getElementById(`quickadd-${firstMissing}`)
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" })
      target?.focus()
      return
    }
    setQuickSaving(true)
    try {
      if (editingResident && selectedResident) {
        const name = [quickAdd.firstName.trim(), quickAdd.middleName?.trim(), quickAdd.lastName.trim(), quickAdd.suffix?.trim()].filter(Boolean).join(" ")
        const address = [[quickAdd.houseNumber?.trim(), quickAdd.street.trim()].filter(Boolean).join(" "), `Purok ${quickAdd.purok}`, "Mayondon"].filter(Boolean).join(", ")
        const resident = await issuanceApi.updateResident(selectedResident.id, { name, firstName: quickAdd.firstName.trim(), middleName: quickAdd.middleName?.trim() ?? "", lastName: quickAdd.lastName.trim(), suffix: quickAdd.suffix?.trim() ?? "", birthdate: quickAdd.birthdate, birthplace: quickAdd.birthplace?.trim() ?? "", sex: quickAdd.sex, civilStatus: quickAdd.civilStatus, houseNumber: quickAdd.houseNumber?.trim() ?? "", street: quickAdd.street.trim(), purok: quickAdd.purok, address, residentSince: quickAdd.residentSinceBirth ? 0 : quickAdd.residentSinceYear, residentSinceBirth: quickAdd.residentSinceBirth, photoUrl: quickAdd.photoUrl })
        setResidents((previous) => previous.map((item) => item.id === resident.id ? resident : item))
        setSelectedResident(resident)
        setResidentUpdates((previous) => {
          const next = { ...previous }
          delete next.birthdate
          delete next.birthplace
          delete next.sex
          delete next.civilStatus
          delete next.houseNumber
          delete next.street
          delete next.purok
          delete next.address
          delete next.residentSince
          delete next.residentSinceBirth
          delete next.photoUrl
          return next
        })
        setEditingResident(false)
      } else {
        const resident = await issuanceApi.createResident(quickAdd, confirmDuplicate)
        setResidents((previous) => [...previous, resident])
        selectResident(resident)
      }
      setQuickAdd(emptyQuickAdd)
      setQuickAttempted(false)
      setQuickDuplicateSignature(null)
      setFormError("")
    } catch (error) {
      const failure = error as { code?: string; message?: string }
      if (!editingResident && failure.code === "possible_duplicate") {
        setQuickDuplicateSignature(JSON.stringify(quickAdd))
        setFormError(t("issuances.new.resident.errors.duplicate"))
      } else {
        setFormError(failure.message || (editingResident ? t("issuances.new.resident.errors.updateFailed") : t("issuances.new.resident.errors.addFailed")))
      }
    } finally {
      setQuickSaving(false)
    }
  }

  const quickError = (key: keyof typeof quickMissing) => quickAttempted && quickMissing[key]
    ? <span id={`quickadd-${key}-error`} role="alert" className="text-xs font-normal text-destructive">{t("issuances.new.resident.errors.fillThis")}</span>
    : null
  const quickInvalid = (key: keyof typeof quickMissing) => quickAttempted && quickMissing[key]

  const needsAddress = Boolean(selectedResident) && (!selectedResident?.houseNumber?.trim() || !selectedResident?.street?.trim() || !selectedResident?.purok)
  // The photo has its own step (see "Photo" below), so it is never listed in the yellow "details are missing" box.
  const needsPhoto = config.residentNeeds.includes("photo")
  const neededFromRecord: string[] = selectedResident
    ? Array.from(new Set([
        ...config.residentNeeds.filter((need) => need !== "photo").filter((need) => {
          const residentValue = need === "birthDate" ? selectedResident.birthdate : need === "birthPlace" ? selectedResident.birthplace : need === "civilStatus" ? selectedResident.civilStatus : need === "sex" ? selectedResident.sex : need === "residentSince" ? selectedResident.residentSinceBirth || selectedResident.residentSince : need === "sector" ? selectedResident.sectors.length : need === "photo" ? selectedResident.photoUrl : need === "emergencyContact" ? selectedResident.emergencyContact?.name && selectedResident.emergencyContact?.address && selectedResident.emergencyContact?.phone : undefined
          return !residentValue
        }),
        ...(needsAddress ? ["address"] : []),
      ]))
    : []

  function updateAddress(patch: Partial<typeof addressParts>) {
    const next = { ...addressParts, ...patch }
    setAddressParts(next)
    setResidentUpdates((previous) => ({ ...previous, houseNumber: next.houseNumber, street: next.street, purok: next.purok, address: [[next.houseNumber.trim(), next.street.trim()].filter(Boolean).join(" "), `Purok ${next.purok}`, "Mayondon"].filter(Boolean).join(", ") } as ResidentPatch))
  }

  function renderResidentNeed(need: string) {
    if (!selectedResident) return null
    const patch = (values: Record<string, unknown>) => setResidentUpdates((previous) => ({ ...previous, ...values } as ResidentPatch))
    const updates = residentUpdates as Record<string, unknown>
    if (need === "residentSince") {
      const sinceBirth = Boolean(residentUpdates.residentSinceBirth ?? selectedResident.residentSinceBirth)
      return <div key={need} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className={fieldLabelClass}>{t("issuances.new.resident.fields.livingSince")}<input id="resident-missing-residentSince" type="number" min="1900" max={new Date().getFullYear()} placeholder={t("issuances.new.resident.yearExample")} value={sinceBirth ? "" : String(residentUpdates.residentSince ?? "")} onChange={(event) => patch({ residentSince: event.target.value ? Number(event.target.value) : undefined, residentSinceBirth: false })} className={formControlClass} disabled={sinceBirth} /></label>
        <CheckField label={t("issuances.new.resident.fields.sinceBirth")} checked={sinceBirth} onChange={(checked) => patch({ residentSinceBirth: checked, residentSince: checked ? 0 : undefined })} />
      </div>
    }
    if (need === "address") {
      return <div key={need} className="space-y-2">
        <p className="text-sm font-medium">{t("issuances.new.resident.missing.homeAddress")}</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <label className={fieldLabelClass}>{t("issuances.new.resident.fields.houseNumber")}<input id="resident-missing-address-houseNumber" value={addressParts.houseNumber} onChange={(event) => updateAddress({ houseNumber: event.target.value })} className={formControlClass} autoComplete="off" /></label>
          <div className={fieldLabelClass}><label htmlFor="resident-missing-address-street">{t("issuances.new.resident.fields.street")}</label><ComboField id="resident-missing-address-street" value={addressParts.street} options={knownStreets} onChange={(next) => updateAddress({ street: next })} /></div>
          <div className={fieldLabelClass}><label htmlFor="resident-missing-address-purok">{t("issuances.new.resident.fields.purok")}</label><SelectField id="resident-missing-address-purok" value={String(addressParts.purok)} options={purokChoices} onChange={(next) => updateAddress({ purok: Number(next) })} /></div>
        </div>
      </div>
    }
    if (need === "emergencyContact") {
      const current = { name: "", address: "", phone: "", ...selectedResident.emergencyContact, ...residentUpdates.emergencyContact }
      return <div key={need} className="space-y-2">
        <p className="text-sm font-medium">{t("issuances.new.resident.missing.emergencyTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["name", "address", "phone"] as const).map((part) => <label key={part} className={fieldLabelClass}>{part === "phone" ? t("issuances.new.resident.missing.contactNumber") : part === "name" ? t("issuances.new.resident.missing.fullName") : t("issuances.new.resident.missing.address")}<input id={part === "name" ? "resident-missing-emergencyContact" : undefined} value={current[part]} onChange={(event) => patch({ emergencyContact: { ...current, [part]: event.target.value } })} className={formControlClass} autoComplete="off" /></label>)}
        </div>
      </div>
    }
    if (need === "birthDate") {
      return <div key={need} className={fieldLabelClass}><label htmlFor="resident-missing-birthDate">{t("issuances.new.resident.fields.birthdate")}</label><DateField id="resident-missing-birthDate" value={String(updates.birthdate ?? "")} max={localIsoDate()} startView="years" showToday={false} placeholder={t("issuances.new.resident.chooseBirthdate")} onChange={(next) => patch({ birthdate: next })} /></div>
    }
    if (need === "sex") {
      return <div key={need} className={fieldLabelClass}><span id="resident-missing-sex-label">{t("issuances.new.resident.fields.sex")}</span><ChoiceRow id="resident-missing-sex" label={t("issuances.new.resident.fields.sex")} value={String(updates.sex ?? "")} options={["Male", "Female"]} optionLabel={(option) => sexLabel(option, t)} onChange={(next) => patch({ sex: next })} /></div>
    }
    if (need === "civilStatus" || need === "sector") {
      const key = need
      const choices = need === "civilStatus" ? civilStatusOptions : ["STUDENT", "Senior Citizens", "Person with Disabilities (PWD)", "Solo Parents"]
      const current = need === "sector" ? (residentUpdates.sectors?.[0] ?? "") : String(updates[key] ?? "")
      return <div key={need} className={fieldLabelClass}><label htmlFor={`resident-missing-${need}`}>{need === "civilStatus" ? t("issuances.new.resident.fields.civilStatus") : t("issuances.new.resident.fields.sector")}</label><SelectField id={`resident-missing-${need}`} value={current} options={choices} onChange={(next) => patch({ [key]: need === "sector" ? [next] : next })} /></div>
    }
    const key = need === "birthPlace" ? "birthplace" : need
    const label = need === "birthPlace" ? t("issuances.new.resident.fields.placeOfBirth") : need
    return <label key={need} className={fieldLabelClass}>{label}<input id={`resident-missing-${need}`} value={String(updates[key] ?? "")} onChange={(event) => patch({ [key]: event.target.value })} className={formControlClass} autoComplete="off" /></label>
  }

  const fieldsByGroup = (group: DetailFieldConfig["group"]) => config.fields.filter((field) => field.group === group)

  function previewValue(field: DetailFieldConfig): string {
    const detailValues = details as unknown as Record<string, unknown>
    let value: unknown
    if (field.group === "identity") {
      const identityValues = identification as unknown as Record<string, unknown> | undefined
      const key = field.name === "idType" ? "idTypeId" : field.name === "idNumber" ? "idNumber" : field.name === "idPlaceOfIssue" ? "placeOfIssue" : "dateOfIssue"
      value = identityValues?.[key]
      if (field.name === "idType") value = field.options?.[Number(value ?? 0) - 1] ?? ""
    } else if (field.group === "payment") {
      const paymentValues = payment as unknown as Record<string, unknown> | undefined
      value = field.name === "isFree" ? paymentValues?.isFree ? t("issuances.new.options.Yes") : t("issuances.new.options.No") : paymentValues?.[paymentKeyOf(field.name)]
    } else if (field.name === "purpose") value = form.getValues("purposeText")
    else if (field.name === "remarks") value = form.getValues("remarks")
    else if (field.name === "idNumber" && documentType === "BARANGAY_ID") value = (detailValues.idNumber as string | undefined) ?? selectedResident?.idNumber ?? ""
    else if (field.name === "sector") value = selectedSector
    else if (field.name === "sectorIdNumber") value = form.getValues("sectors")?.[0]?.idNumber
    else if (field.name === "for") value = detailValues.forSelf === false ? t("issuances.new.options.Someone else") : t("issuances.new.options.Myself")
    else if (field.name === "relationship") value = detailValues.beneficiaryRelationship
    else if (field.name === "witnessOfficialId") value = currentOfficials.find((official) => official.id === detailValues.witnessOfficialId)?.name
    else value = detailValues[field.name]
    if (Array.isArray(value)) return value.join(", ")
    if (typeof value === "boolean") return value ? t("issuances.new.options.Yes") : t("issuances.new.options.No")
    return value == null ? "" : String(value)
  }

  function fieldVisible(field: DetailFieldConfig): boolean {
    if (!field.showWhen) return true
    const values = details as unknown as Record<string, unknown>
    return field.showWhen({ ...values, for: values.forSelf === false ? "Someone else" : "Myself" })
  }

  function fieldHasValue(field: DetailFieldConfig): boolean {
    const value = previewValue(field)
    if (field.name === "isJobstartBeneficiary") return true
    if (field.name === "officialReceiptNo" && payment?.isFree) return true
    return value.trim().length > 0
  }

  const previewRowsRaw = [
    { label: "Resident", value: selectedResident ? formatPrintedName(selectedResident.firstName, selectedResident.middleName, selectedResident.lastName, printedNameType[documentType], selectedResident.suffix) : "" },
    { label: "Address", value: selectedResident ? getResidentAddress(selectedResident) : "" },
    { label: "Birthdate", value: selectedResident?.birthdate ?? "" },
    { label: "Birthplace", value: selectedResident?.birthplace ?? "" },
    { label: "Sex", value: selectedResident?.sex ? sexLabel(selectedResident.sex, t) : "" },
    { label: "Civil status", value: selectedResident?.civilStatus ? civilStatusLabel(selectedResident.civilStatus, t) : "" },
    ...(needsPhoto ? [{ label: "Photo", value: selectedResident && (residentUpdates.photoUrl || selectedResident.photoUrl) ? t("issuances.new.previewRows.taken") : "" }] : []),
    { label: "Date on document", value: issueDate },
    ...(config.signatoryMode === "select" ? [{ label: "Signatory", value: currentOfficials.find((official) => official.id === form.watch("signatoryOfficialId"))?.name ?? "________________________" }] : []),
    ...config.fields.map((field) => ({ label: field.label, value: previewValue(field) })),
    ...(config.residentNeeds.includes("residentSince") ? [{ label: documentType === "RESIDENCY" ? "Residing since" : "Years of residency", value: selectedResident ? (() => { const source = { ...selectedResident, ...residentUpdates }; if (documentType === "RESIDENCY") return source.residentSinceBirth || source.residentSince === 0 ? t("issuances.new.previewRows.sinceBirth") : source.residentSince === undefined ? "" : String(source.residentSince); if (source.residentSinceBirth) return calculateAge(source.birthdate ?? selectedResident.birthdate, issueDate); return !source.residentSince ? "" : String(Math.max(0, new Date(`${issueDate}T00:00:00`).getFullYear() - source.residentSince)) })() : "" }] : []),
  ]

  const previewLabels: Record<string, string> = {
    Resident: t("issuances.new.previewRows.resident"),
    Address: t("issuances.new.previewRows.address"),
    Birthdate: t("issuances.new.previewRows.birthdate"),
    Birthplace: t("issuances.new.previewRows.birthplace"),
    Sex: t("issuances.new.previewRows.sex"),
    "Civil status": t("issuances.new.previewRows.civilStatus"),
    Photo: t("issuances.new.previewRows.photo"),
    "Date on document": t("issuances.new.previewRows.dateOnDocument"),
    Signatory: t("issuances.new.previewRows.signatory"),
    "Years of residency": t("issuances.new.previewRows.yearsOfResidency"),
    "Resident record": t("issuances.new.previewRows.residentRecord"),
  }
  const previewLabel = (label: string) => previewLabels[label] ?? fieldLabel(label, t)
  const previewRows = Array.from(new Map(previewRowsRaw.map((row) => [row.label, row])).values()).map((row) => ({ ...row, label: previewLabel(row.label) }))

  const residentMissingLabels: { name: string; label: string }[] = (selectedResident ? getMissingResidentFields(selectedResident, documentType).filter((need) => {
      if (need === "address") return !residentUpdates.address && (!selectedResident.houseNumber?.trim() || !selectedResident.street?.trim() || !selectedResident.purok)
      if (need === "birthDate") return !residentUpdates.birthdate && !selectedResident.birthdate
      if (need === "birthPlace") return !residentUpdates.birthplace && !selectedResident.birthplace
      if (need === "civilStatus") return !residentUpdates.civilStatus && !selectedResident.civilStatus
      if (need === "sex") return !residentUpdates.sex && !selectedResident.sex
      if (need === "residentSince") return !residentUpdates.residentSince && !residentUpdates.residentSinceBirth && !selectedResident.residentSince && !selectedResident.residentSinceBirth
      if (need === "sector") return !residentUpdates.sectors?.length && !selectedResident.sectors.length
      if (need === "photo") return !residentUpdates.photoUrl && !selectedResident.photoUrl
      if (need === "emergencyContact") return !residentUpdates.emergencyContact?.name || !residentUpdates.emergencyContact.address || !residentUpdates.emergencyContact.phone
      return false
    }).map((need) => ({ name: need, label: ({ address: t("issuances.new.resident.need.address"), birthDate: t("issuances.new.resident.need.birthDate"), birthPlace: t("issuances.new.resident.need.birthPlace"), civilStatus: t("issuances.new.resident.need.civilStatus"), sex: t("issuances.new.resident.need.sex"), residentSince: t("issuances.new.resident.need.residentSince"), sector: t("issuances.new.resident.need.sector"), photo: t("issuances.new.resident.need.photo"), emergencyContact: t("issuances.new.resident.need.emergencyContact") } as Record<string, string>)[need] ?? need })) : [])

  const missingPreviewLabels = [
    ...(!selectedResident ? [{ name: "resident-search", label: previewLabel("Resident record") }] : []),
    ...config.fields.filter((field) => fieldVisible(field) && field.required && !fieldHasValue(field)).map((field) => ({ name: field.name, label: fieldLabel(field.label, t) })),
    ...(!issueDate ? [{ name: "date", label: previewLabel("Date on document") }] : []),
    ...(config.signatoryMode === "select" && availableSignatories.length > 0 && !form.watch("signatoryOfficialId") ? [{ name: "signatoryOfficialId", label: previewLabel("Signatory") }] : []),
    ...residentMissingLabels,
  ]


  // "residentSince" is a resident-record value (asked under step 2 only when missing), so it is not asked a second time here.
  const detailFields = fieldsByGroup("main").filter((field) => fieldVisible(field) && field.name !== "residentSince")
  const requirementFields = [...fieldsByGroup("identity"), ...fieldsByGroup("payment")].filter(fieldVisible)
  const hasRequirements = requirementFields.length > 0
  const signatoryMissing = config.signatoryMode === "select" && availableSignatories.length > 0 && !form.watch("signatoryOfficialId")
  const detailsDone = !signatoryMissing && detailFields.every((field) => !field.required || fieldHasValue(field))
  const requirementsDone = requirementFields.every((field) => !field.required || fieldHasValue(field))
  const residentDone = Boolean(selectedResident) && residentMissingLabels.every((item) => item.name === "photo")
  const currentPhoto = String(selectedResident && !editingResident ? residentUpdates.photoUrl ?? selectedResident.photoUrl ?? "" : quickAdd.photoUrl ?? "")
  const photoDone = Boolean(currentPhoto)
  const detailsStep = needsPhoto ? 4 : 3
  const requirementsStep = detailsStep + 1
  const remaining = missingPreviewLabels.length

  function goToFirstMissing() {
    const candidates: string[] = []
    if (!selectedResident) candidates.push("issuance-resident-search")
    for (const item of residentMissingLabels) candidates.push(item.name === "address" ? "resident-missing-address-houseNumber" : `resident-missing-${item.name}`)
    if (!issueDate) candidates.push("issuance-date")
    if (signatoryMissing) candidates.push("issuance-signatoryOfficialId")
    for (const field of config.fields) if (fieldVisible(field) && field.required && !fieldHasValue(field)) candidates.push(`issuance-${field.name}`)
    for (const id of candidates) {
      const target = document.getElementById(id)
      if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); target.focus(); return }
    }
  }

  function issueAnother() {
    const keep = successRecord && selectedResident?.id === successRecord.residentId ? selectedResident : undefined
    resetDialog()
    if (!keep) return
    // After a reset the form is back on the default document, so keep only the resident (no sector prefill from the previous type).
    setSelectedResident(keep)
    form.setValue("residentId", keep.id, { shouldDirty: false })
    setAddressParts({ houseNumber: keep.houseNumber ?? "", street: keep.street ?? "", purok: keep.purok ?? 1 })
  }

  return <Dialog open={open} onOpenChange={requestClose}>
    <DialogContent
      className="flex h-[96dvh] max-h-[96dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]"
      onEscapeKeyDown={(event) => {
        // Esc closes an open dropdown, calendar or the name search first, not the whole form.
        const target = event.target as HTMLElement | null
        const searching = target?.id === "issuance-resident-search" && Boolean((target as HTMLInputElement).value)
        if (popoverIsOpen() || searching) event.preventDefault()
      }}
    >
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
        <DialogTitle>{t("issuances.new.title")}</DialogTitle>
        <DialogDescription>{t("issuances.new.description")}</DialogDescription>
      </DialogHeader>
      {successRecord ? <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center" role="status">
        <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold">{t("issuances.new.success.issued", { reference: successRecord.referenceNo })}</p>
          <p className="mt-1 text-sm text-muted-foreground">{selectedResident ? t("issuances.new.success.saved", { document: documentName(documentType, t), resident: selectedResident.name }) : t("issuances.new.success.savedNoResident", { document: documentName(documentType, t) })}</p>
          {printNotice ? <p role="status" className="mx-auto mt-3 max-w-md rounded-lg border bg-muted/50 px-3 py-2 text-sm">{printNotice}</p> : null}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => successRecord && handlePrint(successRecord)}><Printer className="size-4" />{t("issuances.new.success.print")}</Button>
          <Button type="button" variant="outline" onClick={issueAnother}>{t("issuances.new.success.issueAnother")}</Button>
          <Button type="button" onClick={() => { resetDialog(); onOpenChange(false) }}>{t("issuances.new.success.done")}</Button>
        </div>
      </div> : <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void issue() }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void issue() } }}>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_368px]">
          <div className="min-h-0 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-5">
            <IssuanceSection id="issuance-step-document" step={1} title={t("issuances.new.documentStep.title")} done>
              <DocumentTypePicker value={documentType} onChange={changeDocumentType} />
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-t pt-4">
                <div className={cn(fieldLabelClass, "w-full sm:w-64")}><label htmlFor="issuance-date">{t("issuances.new.documentStep.dateOnDocument")}</label>
                  <DateField id="issuance-date" value={issueDate} onChange={(nextDate) => { form.setValue("issueDate", nextDate, { shouldDirty: true }); if (documentType === "BARANGAY_ID" && !validUntilEdited && nextDate) { const validDate = new Date(`${nextDate}T00:00:00`); validDate.setFullYear(validDate.getFullYear() + 1); setDetail("validUntil", localIsoDate(validDate)) } }} />
                </div>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Printer className="size-3.5" aria-hidden="true" />{config.printMode === "overlay" ? t("issuances.new.documentStep.printsOverlay") : t("issuances.new.documentStep.printsFull")}</span>
                  {config.validityMonths ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />{config.validityMonths === 12 ? t("issuances.new.documentStep.validForYear") : t("issuances.new.documentStep.validForMonths", { count: config.validityMonths })}</span> : null}
                  {config.onePerResident ? <span>{t("issuances.new.documentStep.onePerResident")}</span> : null}
                </p>
              </div>
            </IssuanceSection>

            <IssuanceSection id="issuance-step-resident" step={2} title={t("issuances.new.resident.title")} description={selectedResident && !editingResident ? t("issuances.new.resident.descriptionChosen") : editingResident ? t("issuances.new.resident.descriptionEditing") : t("issuances.new.resident.descriptionSearch")} done={residentDone}>
              {selectedResident && !editingResident ? <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{selectedResident.name}</p>
                    <p className="mt-0.5 text-sm">{getResidentAddress(selectedResident)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{selectedResident.birthdate ? t("issuances.new.resident.yearsOld", { age: calculateAge(selectedResident.birthdate, issueDate) }) : t("issuances.new.resident.birthdateNotRecorded")} · {selectedResident.civilStatus ? civilStatusLabel(selectedResident.civilStatus, t) : t("issuances.new.resident.civilStatusNotRecorded")}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setQuickAdd({ lastName: selectedResident.lastName, firstName: selectedResident.firstName, middleName: selectedResident.middleName ?? "", suffix: selectedResident.suffix ?? "", birthdate: selectedResident.birthdate ?? "", birthplace: selectedResident.birthplace ?? "", sex: selectedResident.sex ?? "", civilStatus: selectedResident.civilStatus || "Single", houseNumber: selectedResident.houseNumber ?? "", street: selectedResident.street ?? "", purok: selectedResident.purok ?? 1, residentSinceYear: selectedResident.residentSinceBirth ? undefined : selectedResident.residentSince, residentSinceBirth: Boolean(selectedResident.residentSinceBirth), photoUrl: residentUpdates.photoUrl ?? selectedResident.photoUrl ?? "" }); setEditingResident(true); setQuickAttempted(false) }}>{t("issuances.new.resident.editResident")}</Button><Button type="button" variant="outline" size="sm" onClick={() => { setSelectedResident(null); setEditingResident(false); form.setValue("residentId", ""); setResidentQuery(""); setQuickAdd(emptyQuickAdd); setQuickAttempted(false); setQuickDuplicateSignature(null); setFormError("") }}>{t("issuances.new.resident.chooseSomeoneElse")}</Button></div>
              </div> : <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted-foreground" aria-hidden="true" />
                  <input id="issuance-resident-search" value={residentQuery} onChange={(event) => { setResidentQuery(event.target.value); setActiveResidentMatch(0) }} onKeyDown={(event) => { if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.min(index + 1, matches.length - 1)) } if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.max(index - 1, 0)) } if (event.key === "Enter" && matches[activeResidentMatch]) { event.preventDefault(); selectResident(matches[activeResidentMatch]) } if (event.key === "Escape" && residentQuery) { event.preventDefault(); event.stopPropagation(); setResidentQuery("") } }} placeholder={t("issuances.new.resident.searchPlaceholder")} autoComplete="off" className={cn(formControlClass, "h-12 pl-11 text-base")} aria-label={t("issuances.new.resident.searchLabel")} role="combobox" aria-autocomplete="list" aria-expanded={matches.length > 0} aria-controls="issuance-resident-results" aria-activedescendant={matches[activeResidentMatch] ? `issuance-resident-option-${matches[activeResidentMatch].id}` : undefined} />
                </div>
                {matches.length ? <div id="issuance-resident-results" role="listbox" className="overflow-hidden rounded-lg border shadow-xs">{matches.map((resident, index) => <button type="button" key={resident.id} id={`issuance-resident-option-${resident.id}`} role="option" aria-selected={activeResidentMatch === index} disabled={resident.status === "Archived"} onMouseEnter={() => setActiveResidentMatch(index)} onClick={() => selectResident(resident)} className={cn("flex min-h-14 w-full flex-col items-start justify-center border-b px-4 py-2 text-left last:border-b-0 hover:bg-muted", activeResidentMatch === index && "bg-muted", resident.status === "Archived" && "cursor-not-allowed opacity-50")}>
                  <span className="text-base font-medium">{resident.name}{resident.status === "Archived" ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t("issuances.new.resident.archived")}</span> : null}</span>
                  <span className="text-sm text-muted-foreground">{getResidentAddress(resident)}</span>
                </button>)}</div> : searching ? <p role="status" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("issuances.new.resident.searching")}</p> : searchFailed ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{t("issuances.new.resident.searchFailed")}</p> : trimmedQuery && !selectedResident ? <p className="rounded-lg border border-dashed p-4 text-sm">{t("issuances.new.resident.noOneFound")}</p> : null}
                <fieldset disabled={quickSaving} className="min-w-0 space-y-4 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-baseline justify-between gap-2"><p className="font-semibold">{editingResident ? t("issuances.new.resident.editDetails") : t("issuances.new.resident.addNew")}</p><span className="text-xs text-muted-foreground"><span className="text-destructive">*</span> {t("issuances.new.resident.mustBeFilled")}</span></div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_7.5rem]">
                    <label className={fieldLabelClass}><span>{t("issuances.new.resident.fields.firstName")} <span className="text-destructive">*</span></span><input id="quickadd-firstName" value={quickAdd.firstName} onChange={(event) => setQuickAdd((previous) => ({ ...previous, firstName: event.target.value }))} className={cn(formControlClass, quickInvalid("firstName") && "border-destructive")} aria-invalid={quickInvalid("firstName") || undefined} autoComplete="off" />{quickError("firstName")}</label>
                    <label className={fieldLabelClass}>{t("issuances.new.resident.fields.middleName")}<input value={quickAdd.middleName ?? ""} onChange={(event) => setQuickAdd((previous) => ({ ...previous, middleName: event.target.value }))} className={formControlClass} autoComplete="off" /></label>
                    <label className={fieldLabelClass}><span>{t("issuances.new.resident.fields.lastName")} <span className="text-destructive">*</span></span><input id="quickadd-lastName" value={quickAdd.lastName} onChange={(event) => setQuickAdd((previous) => ({ ...previous, lastName: event.target.value }))} className={cn(formControlClass, quickInvalid("lastName") && "border-destructive")} aria-invalid={quickInvalid("lastName") || undefined} autoComplete="off" />{quickError("lastName")}</label>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-suffix">{t("issuances.new.resident.fields.extension")}</label><SelectField id="quickadd-suffix" value={quickAdd.suffix || "None"} onChange={(next) => setQuickAdd((previous) => ({ ...previous, suffix: next === "None" ? "" : next }))} options={nameExtensionOptions} /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div className={fieldLabelClass}><label htmlFor="quickadd-birthdate">{t("issuances.new.resident.fields.birthdate")} <span className="text-destructive">*</span></label><DateField id="quickadd-birthdate" value={quickAdd.birthdate} max={localIsoDate()} startView="years" showToday={false} placeholder={t("issuances.new.resident.chooseBirthdate")} invalid={quickInvalid("birthdate")} describedBy={quickInvalid("birthdate") ? "quickadd-birthdate-error" : undefined} onChange={(next) => setQuickAdd((previous) => ({ ...previous, birthdate: next }))} />{quickError("birthdate")}</div>
                    <label className={fieldLabelClass}><span>{t("issuances.new.resident.fields.placeOfBirth")}{birthplaceRequired ? <span className="text-destructive"> *</span> : null}</span><input id="quickadd-birthplace" value={quickAdd.birthplace ?? ""} placeholder={t("issuances.new.resident.birthplaceExample")} onChange={(event) => setQuickAdd((previous) => ({ ...previous, birthplace: event.target.value }))} className={cn(formControlClass, quickInvalid("birthplace") && "border-destructive")} aria-invalid={quickInvalid("birthplace") || undefined} autoComplete="off" />{quickError("birthplace")}</label>
                    <div className={fieldLabelClass}><span id="quickadd-sex-label">{t("issuances.new.resident.fields.sex")}{sexRequired ? <span className="text-destructive"> *</span> : null}</span><ChoiceRow id="quickadd-sex" label={t("issuances.new.resident.fields.sex")} value={quickAdd.sex} options={["Male", "Female"]} optionLabel={(option) => sexLabel(option, t)} onChange={(next) => setQuickAdd((previous) => ({ ...previous, sex: next as "Male" | "Female" | "" }))} />{quickError("sex")}</div>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-civil">{t("issuances.new.resident.fields.civilStatus")}</label><SelectField id="quickadd-civil" value={quickAdd.civilStatus} onChange={(next) => setQuickAdd((previous) => ({ ...previous, civilStatus: next }))} options={civilStatusOptions} /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
                    <label className={fieldLabelClass}><span>{t("issuances.new.resident.fields.houseNumber")} <span className="text-destructive">*</span></span><input id="quickadd-houseNumber" value={quickAdd.houseNumber ?? ""} onChange={(event) => setQuickAdd((previous) => ({ ...previous, houseNumber: event.target.value }))} className={cn(formControlClass, quickInvalid("houseNumber") && "border-destructive")} aria-invalid={quickInvalid("houseNumber") || undefined} autoComplete="off" />{quickError("houseNumber")}</label>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-street">{t("issuances.new.resident.fields.street")} <span className="text-destructive">*</span></label><ComboField id="quickadd-street" value={quickAdd.street} options={knownStreets} invalid={quickInvalid("street")} describedBy={quickInvalid("street") ? "quickadd-street-error" : undefined} onChange={(next) => setQuickAdd((previous) => ({ ...previous, street: next }))} />{quickError("street")}</div>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-purok">{t("issuances.new.resident.fields.purok")}</label><SelectField id="quickadd-purok" value={String(quickAdd.purok)} onChange={(next) => setQuickAdd((previous) => ({ ...previous, purok: Number(next) }))} options={purokChoices} /></div>
                  </div>
                  <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <label className={fieldLabelClass}>{t("issuances.new.resident.fields.livingSince")}<input type="number" min="1900" max={new Date().getFullYear()} placeholder={t("issuances.new.resident.yearExample")} value={quickAdd.residentSinceYear ?? ""} disabled={quickAdd.residentSinceBirth} onChange={(event) => setQuickAdd((previous) => ({ ...previous, residentSinceYear: event.target.value ? Number(event.target.value) : undefined }))} className={formControlClass} /></label>
                    <CheckField label={t("issuances.new.resident.fields.sinceBirth")} checked={quickAdd.residentSinceBirth} onChange={(checked) => setQuickAdd((previous) => ({ ...previous, residentSinceBirth: checked, residentSinceYear: undefined }))} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" disabled={!quickAddHasValues() || quickSaving} onClick={() => { if (editingResident && selectedResident) { setQuickAdd({ lastName: selectedResident.lastName, firstName: selectedResident.firstName, middleName: selectedResident.middleName ?? "", suffix: selectedResident.suffix ?? "", birthdate: selectedResident.birthdate ?? "", birthplace: selectedResident.birthplace ?? "", sex: selectedResident.sex ?? "", civilStatus: selectedResident.civilStatus || "Single", houseNumber: selectedResident.houseNumber ?? "", street: selectedResident.street ?? "", purok: selectedResident.purok ?? 1, residentSinceYear: selectedResident.residentSinceBirth ? undefined : selectedResident.residentSince, residentSinceBirth: Boolean(selectedResident.residentSinceBirth), photoUrl: residentUpdates.photoUrl ?? selectedResident.photoUrl ?? "" }) } else setQuickAdd(emptyQuickAdd); setQuickAttempted(false); setQuickDuplicateSignature(null) }}>{editingResident ? t("issuances.new.resident.buttons.resetChanges") : t("issuances.new.resident.buttons.clear")}</Button>{!editingResident && quickDuplicateSignature === JSON.stringify(quickAdd) ? <Button type="button" variant="outline" disabled={quickSaving} onClick={() => void createResident(true)}>{quickSaving ? t("issuances.new.resident.buttons.saving") : t("issuances.new.resident.buttons.saveAnyway")}</Button> : null}<Button type="button" disabled={quickSaving} onClick={() => void createResident()}>{quickSaving ? t("issuances.new.resident.buttons.saving") : editingResident ? t("issuances.new.resident.buttons.saveChanges") : t("issuances.new.resident.buttons.saveAndSelect")}</Button></div>
                </fieldset>
              </div>}
              {selectedResident && neededFromRecord.length ? <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                <div>
                  <p className="font-semibold">{t("issuances.new.resident.missing.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("issuances.new.resident.missing.body", { name: selectedResident.firstName })}</p>
                </div>
                {neededFromRecord.map(renderResidentNeed)}
              </div> : null}
            </IssuanceSection>

            {needsPhoto ? <IssuanceSection id="issuance-step-photo" step={3} title={t("issuances.new.photoStep.title")} description={t("issuances.new.photoStep.description")} done={photoDone}>
              <div className={fieldLabelClass}>
                <span id="resident-missing-photo-label">{t("issuances.new.photoStep.label")} <span className="text-destructive">*</span></span>
                <PhotoCapture id="resident-missing-photo" value={currentPhoto} onChange={(photoUrl) => selectedResident && !editingResident ? setResidentUpdates((previous) => ({ ...previous, photoUrl } as ResidentPatch)) : setQuickAdd((previous) => ({ ...previous, photoUrl }))} />
              </div>
            </IssuanceSection> : null}

            <IssuanceSection id="issuance-step-details" step={detailsStep} title={t("issuances.new.detailsStep.title")} description={t("issuances.new.detailsStep.description")} done={detailsDone}>
              {detailFields.length ? documentType === "INDIGENCY" ? (
                <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2">
                  {detailFields.filter((field) => field.name === "sector").map((field) => <div key={field.name} className="sm:col-span-2">{renderField(field)}</div>)}
                  {detailFields.filter((field) => field.name === "purpose" || field.name === "addressedToOffice").map(renderField)}
                </div>
              ) : <div className="grid items-start gap-4 sm:grid-cols-2">{detailFields.map(renderField)}</div> : <p className="text-sm text-muted-foreground">{t("issuances.new.detailsStep.noExtra")}</p>}
              {config.signatoryMode === "select" ? <div className={fieldLabelClass}>
                <label htmlFor="issuance-signatoryOfficialId">{t("issuances.new.detailsStep.signatory")} {availableSignatories.length > 0 ? <span className="text-destructive">*</span> : null}</label>
                {availableSignatories.length > 0 ? <SelectField id="issuance-signatoryOfficialId" value={form.watch("signatoryOfficialId") ?? ""} onChange={(next) => form.setValue("signatoryOfficialId", next, { shouldDirty: true })} placeholder={t("issuances.new.detailsStep.chooseOfficial")} invalid={Boolean(readErrorMessage(form.formState.errors.signatoryOfficialId)) || (attempted && signatoryMissing)} describedBy={readErrorMessage(form.formState.errors.signatoryOfficialId) ? "issuance-signatory-error" : undefined} options={availableSignatories.map((official) => ({ value: official.id, label: `${official.name} · ${official.position}` }))} /> : <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("issuances.new.detailsStep.noOfficials")}</p>}
                {readErrorMessage(form.formState.errors.signatoryOfficialId) ? <span id="issuance-signatory-error" role="alert" className="text-xs font-normal text-destructive">{readErrorMessage(form.formState.errors.signatoryOfficialId)}</span> : attempted && signatoryMissing ? <span role="alert" className="text-xs font-normal text-destructive">{t("issuances.new.detailsStep.chooseWhoSigns")}</span> : null}
              </div> : null}
              {details.type === "FIRST_TIME_JOBSEEKER" && details.isJobstartBeneficiary ? <p className="text-sm text-muted-foreground">{t("issuances.new.detailsStep.jobstartNote")}</p> : null}
            </IssuanceSection>

            {hasRequirements ? <IssuanceSection id="issuance-step-requirements" step={requirementsStep} title={fieldsByGroup("payment").length ? t("issuances.new.requirementsStep.titleWithPayment") : t("issuances.new.requirementsStep.titleIdOnly")} description={t("issuances.new.requirementsStep.description")} done={requirementsDone}>
              {fieldsByGroup("identity").length ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("issuances.new.requirementsStep.proofOfIdentity")}</p><div className="grid gap-4 sm:grid-cols-2">{fieldsByGroup("identity").map(renderField)}</div></div> : null}
              {fieldsByGroup("payment").length ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("issuances.new.requirementsStep.payment")}</p><div className="grid items-end gap-4 sm:grid-cols-2">{fieldsByGroup("payment").map(renderField)}</div></div> : null}
            </IssuanceSection> : null}

            {duplicate ? <p role="alert" className="rounded-md border border-destructive/40 bg-background p-3 text-sm">{t("issuances.new.duplicate", { reference: duplicate.referenceNo, date: duplicate.issueDate })}</p> : null}
            {formError ? <p role="alert" className="rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive">{formError}</p> : null}

            <div className="lg:hidden">
              <button type="button" className="flex min-h-10 items-center gap-2 text-sm font-medium" aria-expanded={previewOpen} onClick={() => setPreviewOpen((value) => !value)}><ChevronDown className={cn("size-4 transition-transform", previewOpen && "rotate-180")} />{t("issuances.new.preview")}</button>
              {previewOpen ? <div className="mt-2 rounded-xl border bg-card"><PrintSummaryPanel type={config.name} typeLabel={documentName(documentType, t)} currentDate={issueDate} structuredRows={previewRows} missingLabels={attempted ? missingPreviewLabels : []} showMissing={attempted} printingPaused /></div> : null}
            </div>
          </div>
          <aside aria-label={t("issuances.new.preview")} className="hidden min-h-0 overflow-y-auto border-l bg-card lg:block">
            <PrintSummaryPanel type={config.name} typeLabel={documentName(documentType, t)} currentDate={issueDate} structuredRows={previewRows} missingLabels={attempted ? missingPreviewLabels : []} showMissing={attempted} printingPaused />
          </aside>
        </div>
        <DialogFooter className="shrink-0 items-center gap-2 border-t px-5 py-3 sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5 text-sm" aria-live="polite">
            {remaining ? <button type="button" onClick={goToFirstMissing} className="inline-flex min-h-9 items-center gap-1.5 self-start text-amber-700 dark:text-amber-400 underline-offset-4 hover:underline"><CircleAlert className="size-4" aria-hidden="true" />{t("issuances.new.footer.stillNeeded", { count: remaining })}</button> : <span className="inline-flex min-h-9 items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" aria-hidden="true" />{t("issuances.new.footer.ready")}</span>}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="autosave-status">
              <span className={cn("size-2 rounded-full", autoSave.state === "saved" ? "bg-emerald-500" : autoSave.state === "saving" ? "animate-pulse bg-amber-500" : autoSave.state === "error" ? "bg-destructive" : "bg-muted-foreground/40")} aria-hidden="true" />
              {autoSave.state === "saving" ? t("issuances.new.footer.saving") : autoSave.state === "saved" ? t("issuances.new.footer.saved", { time: autoSave.at?.toLocaleTimeString(getLocaleOr("en-US"), { hour: "numeric", minute: "2-digit" }) }) : autoSave.state === "error" ? t("issuances.new.footer.saveError") : selectedResident ? t("issuances.new.footer.autoWithResident") : t("issuances.new.footer.autoNoResident")}
              <span className="ml-2 hidden items-center gap-1 xl:inline-flex"><Keyboard className="size-3.5" aria-hidden="true" />{t("issuances.new.footer.shortcut")}</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => requestClose(false)}>{t("issuances.new.footer.cancel")}</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void saveDraft()}>{t("issuances.new.footer.saveDraftClose")}</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void issue(true)}><Printer className="size-4" aria-hidden="true" />{t("issuances.new.footer.issueAndPrint")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("issuances.new.footer.savingButton") : t("issuances.new.footer.issue")}</Button>
          </div>
        </DialogFooter>
      </form>}
    </DialogContent>
    <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("issuances.new.discard.title")}</DialogTitle>
          <DialogDescription>
            {selectedResident
              ? t("issuances.new.discard.withDraft")
              : t("issuances.new.discard.withoutDraft")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:flex-nowrap sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setDiscardOpen(false)}>{t("issuances.new.discard.keepEditing")}</Button>
          {selectedResident ? <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void closeKeepingDraft()}>{t("issuances.new.discard.closeKeepDraft")}</Button> : null}
          <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => void discardAndClose()}>{t("issuances.new.discard.discard")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={pendingDocumentType !== null}
      onOpenChange={(nextOpen) => { if (!nextOpen) setPendingDocumentType(null) }}
      title={t("issuances.new.changeType.title")}
      description={t("issuances.new.changeType.description")}
      confirmLabel={t("issuances.new.changeType.confirm")}
      onConfirm={() => {
        if (pendingDocumentType) applyDocumentType(pendingDocumentType)
        setPendingDocumentType(null)
      }}
    />
  </Dialog>
}
