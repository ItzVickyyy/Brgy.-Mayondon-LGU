import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, CircleAlert, CheckCircle2, Clock, Keyboard, Printer, Search, UserRoundPlus } from "lucide-react"
import { useNewIssuanceForm, defaultDetails, localIsoDate } from "./useNewIssuanceForm"
import { documentConfig, type DetailFieldConfig, type DocumentCode } from "./documentConfig"
import { getMissingResidentFields, getResidentAddress, issuanceApi, type MockIssuance, type QuickResidentInput, type ResidentPatch } from "./issuanceApi"
import type { ResidentRecord } from "@/components/Records/records-sample-data"
import { initialOfficials } from "@/components/Officials/officials-sample-data"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialResidentId?: string
  /** Called for every save. `meta.auto` is true for the quiet automatic draft saves. */
  onSaved: (record: MockIssuance, meta?: { auto: boolean }) => void
  /** Called when a draft is deleted (discarded, or turned into an issued document). */
  onDraftRemoved?: (id: string) => void
  /** Called when the person asks to print an issued document. */
  onPrint?: (record: MockIssuance) => void
}

const knownStreets = ["Rizal Street", "Mabini Street", "Bonifacio Street"]
const knownAssociations = ["Mayondon Tricycle Operators and Drivers Association"]
const printedNameType: Record<DocumentCode, string> = {
  BARANGAY_CLEARANCE: "Barangay Clearance",
  FRANCHISE_CLEARANCE: "Barangay Franchise Clearance",
  UTILITY_CLEARANCE: "Barangay Clearance, Electrical and Water Connection",
  BUILDING_CLEARANCE: "Building Clearance",
  PHILHEALTH_CERT: "PhilHealth Certification",
  RESIDENCY: "Certification of Residency",
  INDIGENCY: "Certificate of Indigency",
  ASSISTANCE: "Certification (assistance request)",
  MARGINALIZED_SECTOR: "Marginalized Sector Certification (Pagpapatunay)",
  FIRST_TIME_JOBSEEKER: "First-Time Jobseeker Certification",
  BARANGAY_ID: "Barangay ID",
}
const stampDocuments: DocumentCode[] = ["BARANGAY_CLEARANCE", "FRANCHISE_CLEARANCE", "UTILITY_CLEARANCE"]
const identityDocuments: DocumentCode[] = [...stampDocuments, "BUILDING_CLEARANCE"]
type PaymentKey = "officialReceiptNo" | "isFree" | "dateOfPayment" | "certifiedBy"
const paymentKeyOf = (fieldName: string): PaymentKey => (fieldName === "isFree" || fieldName === "dateOfPayment" || fieldName === "certifiedBy" ? fieldName : "officialReceiptNo")
const nameExtensions = ["None", "Jr.", "Sr.", "II", "III", "IV", "V"]
const civilStatusChoices = ["Single", "Married", "Legally Separated", "Widow/Widower"]
const purokChoices = [1, 2, 3, 4, 5, 6].map((purok) => ({ value: String(purok), label: `Purok ${purok}` }))
const fieldLabelClass = "flex min-w-0 flex-col gap-1.5 text-sm font-medium"

function normalizedOptionValue(fieldName: string, option: string) {
  if (fieldName === "referredBy" && option !== "None") return initialOfficials.find((official) => official.status === "Current" && official.name === option)?.id ?? option
  if (fieldName === "witnessOfficialId") return initialOfficials.find((official) => official.status === "Current" && official.name === option)?.id ?? option
  if (fieldName === "services" || fieldName === "connectionType" || fieldName === "classification" || fieldName === "assistanceType" || fieldName === "transactionType") return option.toLowerCase()
  if (fieldName === "isJobstartBeneficiary") return option === "Yes" ? "true" : "false"
  if (fieldName === "parts") return ({ "Applicant sheet": "applicant_sheet", Oath: "oath", Certification: "certification" } as Record<string, string>)[option] ?? option
  return option
}

const emptyQuickAdd: QuickResidentInput = {
  lastName: "", firstName: "", middleName: "", suffix: "", birthdate: "", birthplace: "", sex: "Male", civilStatus: "Single",
  houseNumber: "", street: "", purok: 1, residentSinceBirth: false,
}

function getDefaultToday(value: unknown) {
  return value === "today" ? localIsoDate() : typeof value === "string" ? value : ""
}

export function NewIssuanceDialog({ open, onOpenChange, initialResidentId, onSaved, onDraftRemoved, onPrint }: Props) {
  const form = useNewIssuanceForm(initialResidentId ?? "")
  const [residents, setResidents] = useState<ResidentRecord[]>([])
  const [residentQuery, setResidentQuery] = useState("")
  const [activeResidentMatch, setActiveResidentMatch] = useState(0)
  const [selectedResident, setSelectedResident] = useState<ResidentRecord | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAdd, setQuickAdd] = useState<QuickResidentInput>(emptyQuickAdd)
  const [residentUpdates, setResidentUpdates] = useState<ResidentPatch>({})
  const [selectedSector, setSelectedSector] = useState<string | string[]>("")
  const [sectorManuallySelected, setSectorManuallySelected] = useState(false)
  const [pendingDocumentType, setPendingDocumentType] = useState<DocumentCode | null>(null)
  const [validUntilEdited, setValidUntilEdited] = useState(false)
  const [addressParts, setAddressParts] = useState(() => ({ houseNumber: selectedResident?.houseNumber ?? "", street: selectedResident?.street ?? "", purok: selectedResident?.purok ?? 1 }))
  const [moreOpen, setMoreOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successRecord, setSuccessRecord] = useState<MockIssuance | null>(null)
  const [duplicate, setDuplicate] = useState<{ referenceNo: string; issueDate: string } | null>(null)
  const [formError, setFormError] = useState("")
  const [discardOpen, setDiscardOpen] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [quickAttempted, setQuickAttempted] = useState(false)
  const [printNotice, setPrintNotice] = useState(false)
  const [autoSave, setAutoSave] = useState<{ state: "idle" | "saving" | "saved" | "error"; at?: Date }>({ state: "idle" })
  const draftIdRef = useRef<string | null>(null)
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
  const matches = useMemo(() => {
    const query = residentQuery.trim().toLowerCase()
    if (!query || selectedResident) return []
    return allResidents.filter((resident) => [resident.name, resident.id, resident.idNumber, resident.address].some((value) => value.toLowerCase().includes(query))).slice(0, 6)
  }, [allResidents, residentQuery, selectedResident])

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
    const signatory = signatoryDefault ? initialOfficials.find((official) => official.status === "Current" && official.position === signatoryDefault) : undefined
    form.setValue("signatoryOfficialId", signatory?.id)
    form.clearErrors()
    setSelectedSector("")
    setSectorManuallySelected(false)
    if (selectedResident) prefillResidentSector(nextCode, selectedResident)
    setValidUntilEdited(false)
    setDuplicate(null)
    setFormError("")
  }

  function selectResident(resident: ResidentRecord) {
    if (resident.status === "Archived") return
    setSelectedResident(resident)
    setResidentQuery("")
    form.setValue("residentId", resident.id, { shouldDirty: true })
    setResidentUpdates({})
    setAddressParts({ houseNumber: resident.houseNumber ?? "", street: resident.street ?? "", purok: resident.purok ?? 1 })
    prefillResidentSector(documentType, resident)
    setSectorManuallySelected(false)
    setDuplicate(null)
    setFormError("")
  }

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
    return typeof message === "string" ? message : ""
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
    const key = field.name === "relationship" ? "beneficiaryRelationship" : field.name === "referredBy" ? "referredByOfficialId" : field.name
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
        : field.name === "idNumber" && documentType === "BARANGAY_ID" ? selectedResident?.idNumber?.split("-").at(-1) ?? issuanceApi.getNextBarangayIdNumber()
        : field.name === "sector" ? selectedSector
        : field.name === "referredBy" ? (details as unknown as Record<string, unknown>).referredByOfficialId ?? "None"
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
      else if (field.name === "referredBy") setDetail("referredByOfficialId", String(nextValue) === "None" ? undefined : String(nextValue))
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
    const fieldOptions = field.name === "associationName" ? knownAssociations : field.name === "referredBy" ? ["None", ...initialOfficials.filter((official) => official.status === "Current").map((official) => official.name)] : field.name === "witnessOfficialId" ? initialOfficials.filter((official) => official.status === "Current").map((official) => official.name) : field.options ?? []
    const missingNow = attempted && Boolean(field.required) && !fieldHasValue(field)
    const invalid = Boolean(fieldError) || missingNow
    const describedBy = fieldError || missingNow ? `${fieldId}-error` : undefined
    const labelText = <>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</>
    const message = fieldError || (missingNow ? "Please fill this in." : "")
    const messageNode = message ? <span id={`${fieldId}-error`} className="text-xs font-normal text-destructive" role="alert">{message}</span> : null
    if (field.type === "checkbox") {
      return <div key={field.name} className="flex min-h-11 items-center">
        <CheckField id={fieldId} checked={Boolean(value)} onChange={(checked) => onValueChange(checked)} label={field.label} invalid={invalid} describedBy={describedBy} />
      </div>
    }
    let control: ReactNode
    if (field.type === "combobox") {
      control = <ComboField id={fieldId} value={String(value)} onChange={onValueChange as (next: string) => void} options={fieldOptions} invalid={invalid} describedBy={describedBy} />
    } else if (field.type === "select" || field.type === "radio") {
      control = <SelectField id={fieldId} value={String(value)} onChange={onValueChange as (next: string) => void} options={fieldOptions.map((option) => ({ value: normalizedOptionValue(field.name, option), label: option }))} invalid={invalid} describedBy={describedBy} />
    } else if (field.type === "multiselect") {
      const current = Array.isArray(value) ? value as string[] : []
      control = <fieldset aria-labelledby={`${fieldId}-label`} className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
        {(field.options ?? []).map((option) => {
          const optionKey = normalizedOptionValue(field.name, option)
          const checked = current.includes(optionKey)
          return <CheckField key={option} variant="box" id={option === field.options?.[0] ? fieldId : undefined} label={option} checked={checked} disabled={Boolean(field.maxSelected && current.length >= field.maxSelected && !checked)} invalid={invalid} describedBy={describedBy} onChange={(next) => onValueChange(next ? [...current, optionKey] as unknown as string : current.filter((item) => item !== optionKey) as unknown as string)} />
        })}
      </fieldset>
    } else if (field.name === "idNumber" && documentType === "BARANGAY_ID") {
      control = <input id={fieldId} value={String(value)} readOnly className={cn(formControlClass, "bg-muted/50")} />
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
      {field.help ? <span className="text-xs font-normal text-muted-foreground">{field.help}</span> : null}
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
        if (!auto) setFormError(error instanceof Error ? error.message : "Unable to save the draft.")
        return null
      }
    }
    const next = saveChain.current.then(run, run)
    saveChain.current = next
    return next as Promise<MockIssuance | null>
  }

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
      setFormError("Select a resident before saving this draft.")
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
      setFormError("Select a resident before issuing this document.")
      return
    }
    const projectedResident = { ...selectedResident, ...residentUpdates } as ResidentRecord
    const missingResidentFields = getMissingResidentFields(projectedResident, documentType)
    if (missingResidentFields.length) {
      setAttempted(true)
      const onlyPhoto = missingResidentFields.every((need) => need === "photo")
      setFormError(onlyPhoto ? "Please take the resident's photo first. It is in the Photo step." : "Please fill in the missing details in the yellow box under Who is it for?")
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
      setFormError(`Almost there. ${missingPreviewLabels.length === 1 ? "One item is" : `${missingPreviewLabels.length} items are`} still needed. We will take you to the first one.`)
      goToFirstMissing()
      return
    }
    setSaving(true)
    setFormError("")
    try {
      const check = await issuanceApi.checkIssuance(selectedResident.id, documentType)
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
        setFormError("Check the required fields marked above.")
        const firstMissing = config.fields.find((field) => fieldVisible(field) && field.required && !fieldHasValue(field))
        if (firstMissing) {
          const target = document.getElementById(`issuance-${firstMissing.name}`)
          target?.scrollIntoView({ behavior: "smooth", block: "center" })
          target?.focus()
        }
        setSaving(false)
        return
      }
      const record = await issuanceApi.createIssuance(raw)
      // The automatic draft is replaced by the finished document.
      await removeDraft()
      setSuccessRecord(record)
      setPrintNotice(false)
      onSaved(record)
      if (andPrint) handlePrint(record)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to issue this document.")
    } finally {
      setSaving(false)
    }
  }

  function handlePrint(record: MockIssuance) {
    onPrint?.(record)
    setPrintNotice(true)
  }

  function hasTypedValues() {
    return formDirty || Boolean(residentQuery.trim()) || Object.keys(residentUpdates).length > 0 ||
      (showQuickAdd && Boolean(quickAdd.firstName.trim() || quickAdd.lastName.trim() || quickAdd.birthdate || (quickAdd.birthplace ?? "").trim() || quickAdd.street.trim() || quickAdd.houseNumber.trim()))
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
    setResidentQuery("")
    setResidentUpdates({})
    setSelectedSector("")
    setSectorManuallySelected(false)
    setPendingDocumentType(null)
    setAddressParts({ houseNumber: "", street: "", purok: 1 })
    setValidUntilEdited(false)
    setShowQuickAdd(false)
    setMoreOpen(false)
    setPreviewOpen(false)
    setSuccessRecord(null)
    setDuplicate(null)
    setFormError("")
    setAttempted(false)
    setQuickAttempted(false)
    setPrintNotice(false)
    setDiscardOpen(false)
    setQuickAdd(emptyQuickAdd)
    draftIdRef.current = null
    lastSavedRef.current = ""
    saveChain.current = Promise.resolve()
    setAutoSave({ state: "idle" })
  }

  const birthplaceRequired = config.residentNeeds.includes("birthPlace")
  const quickMissing = {
    firstName: !quickAdd.firstName.trim(),
    lastName: !quickAdd.lastName.trim(),
    birthdate: !quickAdd.birthdate,
    birthplace: birthplaceRequired && !(quickAdd.birthplace ?? "").trim(),
    houseNumber: !(quickAdd.houseNumber ?? "").trim(),
    street: !quickAdd.street.trim(),
  }

  async function createResident() {
    const firstMissing = (Object.keys(quickMissing) as (keyof typeof quickMissing)[]).find((key) => quickMissing[key])
    if (firstMissing) {
      setQuickAttempted(true)
      setFormError("")
      const target = document.getElementById(`quickadd-${firstMissing}`)
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" })
      target?.focus()
      return
    }
    try {
      const resident = await issuanceApi.createResident(quickAdd)
      setResidents((previous) => [...previous, resident])
      selectResident(resident)
      setShowQuickAdd(false)
      setQuickAdd(emptyQuickAdd)
      setQuickAttempted(false)
      setFormError("")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to add this resident.")
    }
  }

  const quickError = (key: keyof typeof quickMissing) => quickAttempted && quickMissing[key]
    ? <span id={`quickadd-${key}-error`} role="alert" className="text-xs font-normal text-destructive">Please fill this in.</span>
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
        <label className={fieldLabelClass}>Living here since (year)<input id="resident-missing-residentSince" type="number" min="1900" max={new Date().getFullYear()} placeholder="Example: 2005" value={sinceBirth ? "" : String(residentUpdates.residentSince ?? "")} onChange={(event) => patch({ residentSince: event.target.value ? Number(event.target.value) : undefined, residentSinceBirth: false })} className={formControlClass} disabled={sinceBirth} /></label>
        <CheckField label="Lived here since birth" checked={sinceBirth} onChange={(checked) => patch({ residentSinceBirth: checked, residentSince: checked ? 0 : undefined })} />
      </div>
    }
    if (need === "address") {
      return <div key={need} className="space-y-2">
        <p className="text-sm font-medium">Home address</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <label className={fieldLabelClass}>House number<input id="resident-missing-address-houseNumber" value={addressParts.houseNumber} onChange={(event) => updateAddress({ houseNumber: event.target.value })} className={formControlClass} autoComplete="off" /></label>
          <div className={fieldLabelClass}><label htmlFor="resident-missing-address-street">Street</label><ComboField id="resident-missing-address-street" value={addressParts.street} options={knownStreets} onChange={(next) => updateAddress({ street: next })} /></div>
          <div className={fieldLabelClass}><label htmlFor="resident-missing-address-purok">Purok</label><SelectField id="resident-missing-address-purok" value={String(addressParts.purok)} options={purokChoices} onChange={(next) => updateAddress({ purok: Number(next) })} /></div>
        </div>
      </div>
    }
    if (need === "emergencyContact") {
      const current = { name: "", address: "", phone: "", ...selectedResident.emergencyContact, ...residentUpdates.emergencyContact }
      return <div key={need} className="space-y-2">
        <p className="text-sm font-medium">Person to contact in an emergency</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["name", "address", "phone"] as const).map((part) => <label key={part} className={fieldLabelClass}>{part === "phone" ? "Contact number" : part === "name" ? "Full name" : "Address"}<input id={part === "name" ? "resident-missing-emergencyContact" : undefined} value={current[part]} onChange={(event) => patch({ emergencyContact: { ...current, [part]: event.target.value } })} className={formControlClass} autoComplete="off" /></label>)}
        </div>
      </div>
    }
    if (need === "birthDate") {
      return <div key={need} className={fieldLabelClass}><label htmlFor="resident-missing-birthDate">Birthdate</label><DateField id="resident-missing-birthDate" value={String(updates.birthdate ?? "")} max={localIsoDate()} startView="years" showToday={false} placeholder="Choose the birthdate" onChange={(next) => patch({ birthdate: next })} /></div>
    }
    if (need === "sex") {
      return <div key={need} className={fieldLabelClass}><span id="resident-missing-sex-label">Sex</span><ChoiceRow id="resident-missing-sex" label="Sex" value={String(updates.sex ?? "")} options={["Male", "Female"]} onChange={(next) => patch({ sex: next })} /></div>
    }
    if (need === "civilStatus" || need === "sector") {
      const key = need
      const choices = need === "civilStatus" ? civilStatusChoices : ["STUDENT", "Senior Citizens", "Person with Disabilities (PWD)", "Solo Parents"]
      const current = need === "sector" ? (residentUpdates.sectors?.[0] ?? "") : String(updates[key] ?? "")
      return <div key={need} className={fieldLabelClass}><label htmlFor={`resident-missing-${need}`}>{need === "civilStatus" ? "Civil status" : "Sector"}</label><SelectField id={`resident-missing-${need}`} value={current} options={choices} onChange={(next) => patch({ [key]: need === "sector" ? [next] : next })} /></div>
    }
    const key = need === "birthPlace" ? "birthplace" : need
    const label = need === "birthPlace" ? "Place of birth" : need
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
      value = field.name === "isFree" ? paymentValues?.isFree ? "Yes" : "No" : paymentValues?.[paymentKeyOf(field.name)]
    } else if (field.name === "purpose") value = form.getValues("purposeText")
    else if (field.name === "remarks") value = form.getValues("remarks")
    else if (field.name === "idNumber" && documentType === "BARANGAY_ID") value = selectedResident?.idNumber?.split("-").at(-1) ?? issuanceApi.getNextBarangayIdNumber()
    else if (field.name === "sector") value = selectedSector
    else if (field.name === "sectorIdNumber") value = form.getValues("sectors")?.[0]?.idNumber
    else if (field.name === "for") value = detailValues.forSelf === false ? "Someone else" : "Myself"
    else if (field.name === "relationship") value = detailValues.beneficiaryRelationship
    else if (field.name === "referredBy") value = initialOfficials.find((official) => official.id === detailValues.referredByOfficialId)?.name
    else if (field.name === "witnessOfficialId") value = initialOfficials.find((official) => official.id === detailValues.witnessOfficialId)?.name
    else value = detailValues[field.name]
    if (Array.isArray(value)) return value.join(", ")
    if (typeof value === "boolean") return value ? "Yes" : "No"
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
    { label: "Resident number", value: selectedResident?.id ?? "" },
    { label: "Address", value: selectedResident ? getResidentAddress(selectedResident) : "" },
    { label: "Birthdate", value: selectedResident?.birthdate ?? "" },
    { label: "Birthplace", value: selectedResident?.birthplace ?? "" },
    { label: "Sex", value: selectedResident?.sex ?? "" },
    { label: "Civil status", value: selectedResident?.civilStatus ?? "" },
    ...(needsPhoto ? [{ label: "Photo", value: selectedResident && (residentUpdates.photoUrl || selectedResident.photoUrl) ? "Taken" : "" }] : []),
    { label: "Date on document", value: issueDate },
    ...(config.signatoryMode === "select" ? [{ label: "Signatory", value: initialOfficials.find((official) => official.id === form.watch("signatoryOfficialId"))?.name ?? "" }] : []),
    ...config.fields.map((field) => ({ label: field.label, value: previewValue(field) })),
    ...(config.residentNeeds.includes("residentSince") ? [{ label: documentType === "RESIDENCY" ? "Residing since" : "Years of residency", value: selectedResident ? (() => { const source = { ...selectedResident, ...residentUpdates }; if (documentType === "RESIDENCY") return source.residentSinceBirth || source.residentSince === 0 ? "Since birth" : source.residentSince === undefined ? "" : String(source.residentSince); if (source.residentSinceBirth) return calculateAge(source.birthdate ?? selectedResident.birthdate, issueDate); return !source.residentSince ? "" : String(Math.max(0, new Date(`${issueDate}T00:00:00`).getFullYear() - source.residentSince)) })() : "" }] : []),
  ]

  const previewRows = Array.from(new Map(previewRowsRaw.map((row) => [row.label, row])).values())

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
    }).map((need) => ({ name: need, label: ({ address: "Resident address", birthDate: "Birthdate", birthPlace: "Birthplace", civilStatus: "Civil status", sex: "Sex", residentSince: "Residing since", sector: "Sector", photo: "Photo", emergencyContact: "Emergency contact" } as Record<string, string>)[need] ?? need })) : [])

  const missingPreviewLabels = [
    ...(!selectedResident ? [{ name: "resident-search", label: "Resident record" }] : []),
    ...config.fields.filter((field) => fieldVisible(field) && field.required && !fieldHasValue(field)).map((field) => ({ name: field.name, label: field.label })),
    ...(!issueDate ? [{ name: "date", label: "Date on document" }] : []),
    ...(config.signatoryMode === "select" && !form.watch("signatoryOfficialId") ? [{ name: "signatoryOfficialId", label: "Signatory" }] : []),
    ...residentMissingLabels,
  ]


  // "residentSince" is a resident-record value (asked under step 2 only when missing), so it is not asked a second time here.
  const detailFields = fieldsByGroup("main").filter((field) => fieldVisible(field) && field.name !== "residentSince")
  const requirementFields = [...fieldsByGroup("identity"), ...fieldsByGroup("payment")].filter(fieldVisible)
  const hasRequirements = requirementFields.length > 0
  const signatoryMissing = config.signatoryMode === "select" && !form.watch("signatoryOfficialId")
  const detailsDone = !signatoryMissing && detailFields.every((field) => !field.required || fieldHasValue(field))
  const requirementsDone = requirementFields.every((field) => !field.required || fieldHasValue(field))
  const residentDone = Boolean(selectedResident) && residentMissingLabels.every((item) => item.name === "photo")
  const currentPhoto = String(residentUpdates.photoUrl ?? selectedResident?.photoUrl ?? "")
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
    const keep = successRecord ? allResidents.find((resident) => resident.id === successRecord.residentId) : undefined
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
        <DialogTitle>New Issuance</DialogTitle>
        <DialogDescription>Pick the document, find the resident, fill in the details. Everything on one screen.</DialogDescription>
      </DialogHeader>
      {successRecord ? <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center" role="status">
        <CheckCircle2 className="size-12 text-emerald-600" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold">Issued: {successRecord.referenceNo}</p>
          <p className="mt-1 text-sm text-muted-foreground">{config.name} for {selectedResident?.name ?? "the resident"} was saved.</p>
          {printNotice ? <p role="status" className="mx-auto mt-3 max-w-md rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">Printing is paused until the paper positions are calibrated. The document is saved and nothing was sent to the printer.</p> : null}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => successRecord && handlePrint(successRecord)}><Printer className="size-4" />Print</Button>
          <Button type="button" variant="outline" onClick={issueAnother}>Issue another for this resident</Button>
          <Button type="button" onClick={() => { resetDialog(); onOpenChange(false) }}>Done</Button>
        </div>
      </div> : <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void issue() }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void issue() } }}>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-h-0 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-5">
            <IssuanceSection id="issuance-step-document" step={1} title="What are you issuing?" done>
              <DocumentTypePicker value={documentType} onChange={changeDocumentType} />
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-t pt-4">
                <div className={cn(fieldLabelClass, "w-full sm:w-64")}><label htmlFor="issuance-date">Date on document</label>
                  <DateField id="issuance-date" value={issueDate} onChange={(nextDate) => { form.setValue("issueDate", nextDate, { shouldDirty: true }); if (documentType === "BARANGAY_ID" && !validUntilEdited && nextDate) { const validDate = new Date(`${nextDate}T00:00:00`); validDate.setFullYear(validDate.getFullYear() + 1); setDetail("validUntil", localIsoDate(validDate)) } }} />
                </div>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Printer className="size-3.5" aria-hidden="true" />{config.printMode === "overlay" ? "Prints on the pre-printed form" : "Prints as a full page"}</span>
                  {config.validityMonths ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />Valid for {config.validityMonths === 12 ? "1 year" : `${config.validityMonths} months`}</span> : null}
                  {config.onePerResident ? <span>One per resident</span> : null}
                </p>
              </div>
            </IssuanceSection>

            <IssuanceSection id="issuance-step-resident" step={2} title="Who is it for?" description={selectedResident ? "You can choose someone else if this is the wrong person." : "Type the person's name, then click it in the list."} done={residentDone}>
              {selectedResident ? <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{selectedResident.name}</p>
                    <p className="mt-0.5 text-sm">{getResidentAddress(selectedResident)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{selectedResident.birthdate ? `${calculateAge(selectedResident.birthdate, issueDate)} years old` : "Birthdate not recorded"} · {selectedResident.civilStatus || "Civil status not recorded"} · {selectedResident.id}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedResident(null); form.setValue("residentId", ""); setResidentQuery("") }}>Choose someone else</Button>
              </div> : <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted-foreground" aria-hidden="true" />
                  <input id="issuance-resident-search" value={residentQuery} onChange={(event) => { setResidentQuery(event.target.value); setActiveResidentMatch(0) }} onKeyDown={(event) => { if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.min(index + 1, matches.length - 1)) } if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.max(index - 1, 0)) } if (event.key === "Enter" && matches[activeResidentMatch]) { event.preventDefault(); selectResident(matches[activeResidentMatch]) } if (event.key === "Escape" && residentQuery) { event.preventDefault(); event.stopPropagation(); setResidentQuery("") } }} placeholder="Type the person's name…" autoComplete="off" className={cn(formControlClass, "h-12 pl-11 text-base")} aria-label="Search resident" role="combobox" aria-autocomplete="list" aria-expanded={matches.length > 0} aria-controls="issuance-resident-results" aria-activedescendant={matches[activeResidentMatch] ? `issuance-resident-option-${matches[activeResidentMatch].id}` : undefined} />
                </div>
                {matches.length ? <div id="issuance-resident-results" role="listbox" className="overflow-hidden rounded-lg border shadow-xs">{matches.map((resident, index) => <button type="button" key={resident.id} id={`issuance-resident-option-${resident.id}`} role="option" aria-selected={activeResidentMatch === index} disabled={resident.status === "Archived"} onMouseEnter={() => setActiveResidentMatch(index)} onClick={() => selectResident(resident)} className={cn("flex min-h-14 w-full flex-col items-start justify-center border-b px-4 py-2 text-left last:border-b-0 hover:bg-muted", activeResidentMatch === index && "bg-muted", resident.status === "Archived" && "cursor-not-allowed opacity-50")}>
                  <span className="text-base font-medium">{resident.name}{resident.status === "Archived" ? <span className="ml-2 text-xs font-normal text-muted-foreground">Archived</span> : null}</span>
                  <span className="text-sm text-muted-foreground">{getResidentAddress(resident)}</span>
                </button>)}</div> : residentQuery.trim() ? <p className="rounded-lg border border-dashed p-4 text-sm">No one found with that name. Check the spelling, or add them as a new resident.</p> : null}
                {!showQuickAdd ? <Button type="button" variant="outline" onClick={() => setShowQuickAdd(true)}><UserRoundPlus className="size-4" aria-hidden="true" />Not on the list? Add a new resident</Button> : null}
                {showQuickAdd ? <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-baseline justify-between gap-2"><p className="font-semibold">Add a new resident</p><span className="text-xs text-muted-foreground"><span className="text-destructive">*</span> must be filled in</span></div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_7.5rem]">
                    <label className={fieldLabelClass}><span>First name <span className="text-destructive">*</span></span><input id="quickadd-firstName" value={quickAdd.firstName} onChange={(event) => setQuickAdd((previous) => ({ ...previous, firstName: event.target.value }))} className={cn(formControlClass, quickInvalid("firstName") && "border-destructive")} aria-invalid={quickInvalid("firstName") || undefined} autoComplete="off" />{quickError("firstName")}</label>
                    <label className={fieldLabelClass}>Middle name<input value={quickAdd.middleName ?? ""} onChange={(event) => setQuickAdd((previous) => ({ ...previous, middleName: event.target.value }))} className={formControlClass} autoComplete="off" /></label>
                    <label className={fieldLabelClass}><span>Last name <span className="text-destructive">*</span></span><input id="quickadd-lastName" value={quickAdd.lastName} onChange={(event) => setQuickAdd((previous) => ({ ...previous, lastName: event.target.value }))} className={cn(formControlClass, quickInvalid("lastName") && "border-destructive")} aria-invalid={quickInvalid("lastName") || undefined} autoComplete="off" />{quickError("lastName")}</label>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-suffix">Extension</label><SelectField id="quickadd-suffix" value={quickAdd.suffix || "None"} onChange={(next) => setQuickAdd((previous) => ({ ...previous, suffix: next === "None" ? "" : next }))} options={nameExtensions} /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div className={fieldLabelClass}><label htmlFor="quickadd-birthdate">Birthdate <span className="text-destructive">*</span></label><DateField id="quickadd-birthdate" value={quickAdd.birthdate} max={localIsoDate()} startView="years" showToday={false} placeholder="Choose the birthdate" invalid={quickInvalid("birthdate")} describedBy={quickInvalid("birthdate") ? "quickadd-birthdate-error" : undefined} onChange={(next) => setQuickAdd((previous) => ({ ...previous, birthdate: next }))} />{quickError("birthdate")}</div>
                    <label className={fieldLabelClass}><span>Place of birth{birthplaceRequired ? <span className="text-destructive"> *</span> : null}</span><input id="quickadd-birthplace" value={quickAdd.birthplace ?? ""} placeholder="Example: Los Baños, Laguna" onChange={(event) => setQuickAdd((previous) => ({ ...previous, birthplace: event.target.value }))} className={cn(formControlClass, quickInvalid("birthplace") && "border-destructive")} aria-invalid={quickInvalid("birthplace") || undefined} autoComplete="off" />{quickError("birthplace")}</label>
                    <div className={fieldLabelClass}><span id="quickadd-sex-label">Sex</span><ChoiceRow label="Sex" value={quickAdd.sex} options={["Male", "Female"]} onChange={(next) => setQuickAdd((previous) => ({ ...previous, sex: next as "Male" | "Female" }))} /></div>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-civil">Civil status</label><SelectField id="quickadd-civil" value={quickAdd.civilStatus} onChange={(next) => setQuickAdd((previous) => ({ ...previous, civilStatus: next }))} options={civilStatusChoices} /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
                    <label className={fieldLabelClass}><span>House number <span className="text-destructive">*</span></span><input id="quickadd-houseNumber" value={quickAdd.houseNumber ?? ""} onChange={(event) => setQuickAdd((previous) => ({ ...previous, houseNumber: event.target.value }))} className={cn(formControlClass, quickInvalid("houseNumber") && "border-destructive")} aria-invalid={quickInvalid("houseNumber") || undefined} autoComplete="off" />{quickError("houseNumber")}</label>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-street">Street <span className="text-destructive">*</span></label><ComboField id="quickadd-street" value={quickAdd.street} options={knownStreets} invalid={quickInvalid("street")} describedBy={quickInvalid("street") ? "quickadd-street-error" : undefined} onChange={(next) => setQuickAdd((previous) => ({ ...previous, street: next }))} />{quickError("street")}</div>
                    <div className={fieldLabelClass}><label htmlFor="quickadd-purok">Purok</label><SelectField id="quickadd-purok" value={String(quickAdd.purok)} onChange={(next) => setQuickAdd((previous) => ({ ...previous, purok: Number(next) }))} options={purokChoices} /></div>
                  </div>
                  <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <label className={fieldLabelClass}>Living here since (year)<input type="number" min="1900" max={new Date().getFullYear()} placeholder="Example: 2005" value={quickAdd.residentSinceYear ?? ""} disabled={quickAdd.residentSinceBirth} onChange={(event) => setQuickAdd((previous) => ({ ...previous, residentSinceYear: event.target.value ? Number(event.target.value) : undefined }))} className={formControlClass} /></label>
                    <CheckField label="Lived here since birth" checked={quickAdd.residentSinceBirth} onChange={(checked) => setQuickAdd((previous) => ({ ...previous, residentSinceBirth: checked, residentSinceYear: undefined }))} />
                  </div>
                  <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowQuickAdd(false)}>Cancel</Button><Button type="button" onClick={() => void createResident()}>Save and select</Button></div>
                </div> : null}
              </div>}
              {selectedResident && neededFromRecord.length ? <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                <div>
                  <p className="font-semibold">A few details are missing</p>
                  <p className="text-sm text-muted-foreground">Please fill them in. They will be saved to {selectedResident.firstName}'s record.</p>
                </div>
                {neededFromRecord.map(renderResidentNeed)}
              </div> : null}
            </IssuanceSection>

            {needsPhoto ? <IssuanceSection id="issuance-step-photo" step={3} title="Photo" description="Capture the resident’s photo. It will appear in the photo box automatically." done={photoDone}>
              {selectedResident
                ? <div className={fieldLabelClass}>
                    <span id="resident-missing-photo-label">Resident's photo <span className="text-destructive">*</span></span>
                    <PhotoCapture id="resident-missing-photo" value={currentPhoto} onChange={(photoUrl) => setResidentUpdates((previous) => ({ ...previous, photoUrl } as ResidentPatch))} />
                  </div>
                : <p className="text-sm text-muted-foreground">Choose who it is for above, then take their photo here.</p>}
            </IssuanceSection> : null}

            <IssuanceSection id="issuance-step-details" step={detailsStep} title="Document details" description="Only the fields this document needs. Red asterisk means required." done={detailsDone}>
              {detailFields.length ? <div className="grid gap-4 sm:grid-cols-2">{detailFields.map(renderField)}</div> : <p className="text-sm text-muted-foreground">This document needs no extra details.</p>}
              {config.signatoryMode === "select" ? <div className={fieldLabelClass}>
                <label htmlFor="issuance-signatoryOfficialId">Signatory <span className="text-destructive">*</span></label>
                <SelectField id="issuance-signatoryOfficialId" value={form.watch("signatoryOfficialId") ?? ""} onChange={(next) => form.setValue("signatoryOfficialId", next, { shouldDirty: true })} placeholder="Choose an official…" invalid={Boolean(readErrorMessage(form.formState.errors.signatoryOfficialId)) || (attempted && signatoryMissing)} describedBy={readErrorMessage(form.formState.errors.signatoryOfficialId) ? "issuance-signatory-error" : undefined} options={initialOfficials.filter((official) => official.status === "Current" && ["Punong Barangay", "Barangay Kagawad", "Barangay Clerk", "Administrative Assistant", "SK Chairperson", "OIC Kagawad"].includes(official.position)).map((official) => ({ value: official.id, label: `${official.name} · ${official.position}` }))} />
                {readErrorMessage(form.formState.errors.signatoryOfficialId) ? <span id="issuance-signatory-error" role="alert" className="text-xs font-normal text-destructive">{readErrorMessage(form.formState.errors.signatoryOfficialId)}</span> : attempted && signatoryMissing ? <span role="alert" className="text-xs font-normal text-destructive">Please choose who signs this document.</span> : null}
              </div> : null}
              {fieldsByGroup("more").length ? <div className="rounded-lg border border-dashed p-3">
                <button type="button" className="flex min-h-9 w-full items-center gap-2 text-sm font-medium" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}><ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />Optional extras</button>
                {!moreOpen ? <p className="mt-1 text-xs text-muted-foreground">{fieldsByGroup("more").map((field) => previewValue(field)).filter(Boolean).join(" · ") || "Nothing added. Defaults are fine for most requests."}</p> : <div className="mt-3 grid gap-4 sm:grid-cols-2">{fieldsByGroup("more").map(renderField)}</div>}
              </div> : null}
              {details.type === "FIRST_TIME_JOBSEEKER" && details.isJobstartBeneficiary ? <p className="text-sm text-muted-foreground">JobStart beneficiary selected. The Punong Barangay will determine eligibility.</p> : null}
            </IssuanceSection>

            {hasRequirements ? <IssuanceSection id="issuance-step-requirements" step={requirementsStep} title={fieldsByGroup("payment").length ? "ID presented & payment" : "ID presented"} description="Copy these from the resident's ID and the official receipt." done={requirementsDone}>
              {fieldsByGroup("identity").length ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proof of identity</p><div className="grid gap-4 sm:grid-cols-2">{fieldsByGroup("identity").map(renderField)}</div></div> : null}
              {fieldsByGroup("payment").length ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</p><div className="grid items-end gap-4 sm:grid-cols-2">{fieldsByGroup("payment").map(renderField)}</div></div> : null}
            </IssuanceSection> : null}

            {duplicate ? <p role="alert" className="rounded-md border border-destructive/40 bg-background p-3 text-sm">An issued First-Time Jobseeker certificate already exists: {duplicate.referenceNo}, dated {duplicate.issueDate}. An administrator must void it before another can be issued.</p> : null}
            {formError ? <p role="alert" className="rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive">{formError}</p> : null}

            <div className="lg:hidden">
              <button type="button" className="flex min-h-10 items-center gap-2 text-sm font-medium" aria-expanded={previewOpen} onClick={() => setPreviewOpen((value) => !value)}><ChevronDown className={cn("size-4 transition-transform", previewOpen && "rotate-180")} />Preview of what will print</button>
              {previewOpen ? <div className="mt-2 rounded-xl border bg-card"><PrintSummaryPanel type={config.name} currentDate={issueDate} structuredRows={previewRows} missingLabels={missingPreviewLabels} printingPaused /></div> : null}
            </div>
          </div>
          <aside aria-label="Preview of what will print" className="hidden min-h-0 overflow-y-auto border-l bg-card lg:block">
            <PrintSummaryPanel type={config.name} currentDate={issueDate} structuredRows={previewRows} missingLabels={missingPreviewLabels} printingPaused />
          </aside>
        </div>
        <DialogFooter className="shrink-0 items-center gap-2 border-t px-5 py-3 sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5 text-sm" aria-live="polite">
            {remaining ? <button type="button" onClick={goToFirstMissing} className="inline-flex min-h-9 items-center gap-1.5 self-start text-amber-700 underline-offset-4 hover:underline"><CircleAlert className="size-4" aria-hidden="true" />{remaining} {remaining === 1 ? "item" : "items"} still needed. Go to next</button> : <span className="inline-flex min-h-9 items-center gap-1.5 font-medium text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" />Ready to issue</span>}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="autosave-status">
              <span className={cn("size-2 rounded-full", autoSave.state === "saved" ? "bg-emerald-500" : autoSave.state === "saving" ? "animate-pulse bg-amber-500" : autoSave.state === "error" ? "bg-destructive" : "bg-muted-foreground/40")} aria-hidden="true" />
              {autoSave.state === "saving" ? "Saving draft…" : autoSave.state === "saved" ? `Draft saved automatically at ${autoSave.at?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : autoSave.state === "error" ? "The draft could not be saved. What you typed is still here." : selectedResident ? "Saves as a draft automatically while you type" : "Saves as a draft automatically once you choose a person"}
              <span className="ml-2 hidden items-center gap-1 xl:inline-flex"><Keyboard className="size-3.5" aria-hidden="true" />Ctrl + Enter to issue</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => requestClose(false)}>Cancel</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void saveDraft()}>Save draft &amp; close</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void issue(true)}><Printer className="size-4" aria-hidden="true" />Issue &amp; print</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Issue"}</Button>
          </div>
        </DialogFooter>
      </form>}
    </DialogContent>
    <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Discard the changes to this issuance?</DialogTitle>
          <DialogDescription>
            {selectedResident
              ? "A draft is saved automatically. You can keep it and finish later, or throw everything away."
              : "What you typed so far has not been saved. If you leave now, it will be lost."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-wrap">
          <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
          {selectedResident ? <Button type="button" variant="outline" onClick={() => void closeKeepingDraft()}>Close, keep draft</Button> : null}
          <Button type="button" variant="destructive" onClick={() => void discardAndClose()}>Discard changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={pendingDocumentType !== null}
      onOpenChange={(nextOpen) => { if (!nextOpen) setPendingDocumentType(null) }}
      title="Change document type?"
      description="Details entered for the current document will be cleared. The resident and document date will stay."
      confirmLabel="Change document"
      onConfirm={() => {
        if (pendingDocumentType) applyDocumentType(pendingDocumentType)
        setPendingDocumentType(null)
      }}
    />
  </Dialog>
}
