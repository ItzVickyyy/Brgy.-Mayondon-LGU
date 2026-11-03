import { useMemo, useState } from "react"
import { CalendarDays, ChevronDown, CircleAlert, CheckCircle2, Clock, Keyboard, Printer, Search, UserRoundPlus } from "lucide-react"
import { useNewIssuanceForm, defaultDetails, localIsoDate } from "./useNewIssuanceForm"
import { documentConfig, type DetailFieldConfig, type DocumentCode } from "./documentConfig"
import { getMissingResidentFields, getResidentAddress, issuanceApi, type MockIssuance, type QuickResidentInput, type ResidentPatch } from "./issuanceApi"
import { sampleResidents, type ResidentRecord } from "@/components/Records/records-sample-data"
import { initialOfficials } from "@/components/Officials/officials-sample-data"
import { calculateAge, formatPrintedName } from "@/lib/issuance-format"
import { formControlClass } from "@/components/Common/formStyles"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { PrintSummaryPanel } from "@/components/Issuances/PrintSummaryPanel"
import { IssuanceSection } from "./IssuanceSection"
import { DocumentTypePicker } from "./DocumentTypePicker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialResidentId?: string
  onSaved: (record: MockIssuance) => void
}

const knownStreets = ["Rizal Street", "Mabini Street", "Bonifacio Street"]
const knownAssociations = ["Mayondon Tricycle Operators and Drivers Association"]
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
const fieldLabelClass = "flex min-w-0 flex-col gap-1.5 text-sm font-medium"

function normalizedOptionValue(fieldName: string, option: string) {
  if (fieldName === "referredBy" && option !== "None") return initialOfficials.find((official) => official.status === "Current" && official.name === option)?.id ?? option
  if (fieldName === "witnessOfficialId") return initialOfficials.find((official) => official.status === "Current" && official.name === option)?.id ?? option
  if (fieldName === "services" || fieldName === "connectionType" || fieldName === "classification" || fieldName === "assistanceType" || fieldName === "transactionType") return option.toLowerCase()
  if (fieldName === "isJobstartBeneficiary") return option === "Yes" ? "true" : "false"
  if (fieldName === "parts") return ({ "Applicant sheet": "applicant_sheet", Oath: "oath", Certification: "certification" } as Record<string, string>)[option] ?? option
  return option
}

function getDefaultToday(value: unknown) {
  return value === "today" ? localIsoDate() : typeof value === "string" ? value : ""
}

export function NewIssuanceDialog({ open, onOpenChange, initialResidentId, onSaved }: Props) {
  const form = useNewIssuanceForm(initialResidentId ?? "")
  const [residents, setResidents] = useState<ResidentRecord[]>([])
  const [residentQuery, setResidentQuery] = useState("")
  const [activeResidentMatch, setActiveResidentMatch] = useState(0)
  const [selectedResident, setSelectedResident] = useState<ResidentRecord | null>(() => sampleResidents.find((resident) => resident.id === initialResidentId || resident.name === initialResidentId) ?? null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAdd, setQuickAdd] = useState<QuickResidentInput>({
    lastName: "", firstName: "", middleName: "", birthdate: "", sex: "Male", civilStatus: "Single",
    houseNumber: "", street: "", purok: 1, residentSinceBirth: false,
  })
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
  const documentType = form.watch("documentType")
  const issueDate = form.watch("issueDate")
  const details = form.watch("details")
  const identification = form.watch("identification")
  const payment = form.watch("payment")
  const config = documentConfig[documentType]
  const allResidents = useMemo(() => [...sampleResidents, ...residents], [residents])
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
    form.setValue("identification", nextCode === "BARANGAY_CLEARANCE" || nextCode === "FRANCHISE_CLEARANCE" || nextCode === "UTILITY_CLEARANCE"
      ? { idTypeId: nextCode === "BARANGAY_CLEARANCE" ? 0 : 1, idNumber: "", placeOfIssue: "Los Baños, Laguna", dateOfIssue: localIsoDate() }
      : undefined)
    form.setValue("payment", ["BARANGAY_CLEARANCE", "FRANCHISE_CLEARANCE", "UTILITY_CLEARANCE"].includes(nextCode)
      ? { officialReceiptNo: "", isFree: false } : undefined)
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

  function setPayment(name: "officialReceiptNo" | "isFree", value: string | boolean) {
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
      const key = field.name === "isFree" ? "isFree" : "officialReceiptNo"
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
        ? (payment as unknown as Record<string, unknown> | undefined)?.[field.name === "officialReceiptNo" ? "officialReceiptNo" : "isFree"]
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
        setPayment(field.name === "isFree" ? "isFree" : "officialReceiptNo", nextValue)
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
    return <label key={field.name} htmlFor={fieldId} className={fieldLabelClass}>
      <span>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</span>
      {field.type === "combobox" ? <><input id={fieldId} list={`issuance-options-${field.name}`} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, fieldError && "border-destructive")} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${fieldId}-error` : undefined} required={field.required} /><datalist id={`issuance-options-${field.name}`}>{fieldOptions.map((option) => <option key={option} value={option} />)}</datalist></> : field.type === "select" || field.type === "radio" ? (
        <select id={fieldId} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, fieldError && "border-destructive", "bg-background")} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${fieldId}-error` : undefined} required={field.required}>
          <option value="">Select…</option>
          {fieldOptions.map((option) => <option key={option} value={normalizedOptionValue(field.name, option)}>{option}</option>)}
        </select>
      ) : field.type === "multiselect" ? (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => {
            const current = Array.isArray(value) ? value as string[] : []
            const optionValue = normalizedOptionValue(field.name, option)
            return <label key={option} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-normal">
              <input type="checkbox" checked={current.includes(optionValue)} disabled={Boolean(field.maxSelected && current.length >= field.maxSelected && !current.includes(optionValue))} id={option === field.options?.[0] ? fieldId : undefined} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${fieldId}-error` : undefined} onChange={(event) => onValueChange(event.target.checked ? [...current, optionValue] as unknown as string : current.filter((item) => item !== optionValue) as unknown as string)} />
              {option}
            </label>
          })}
        </div>
      ) : field.type === "checkbox" ? (
        <input id={fieldId} type="checkbox" checked={Boolean(value)} onChange={(event) => onValueChange(event.target.checked)} className="size-4 accent-primary" aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${fieldId}-error` : undefined} />
      ) : field.name === "idNumber" && documentType === "BARANGAY_ID" ? (
        <input id={fieldId} value={String(value)} readOnly className={cn(formControlClass, "bg-muted/50")} />
      ) : field.type === "textarea" ? (
        <textarea id={fieldId} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, fieldError && "border-destructive", "h-auto py-2")} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${fieldId}-error` : undefined} rows={2} />
      ) : (
        <input id={fieldId} type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, fieldError && "border-destructive")} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${fieldId}-error` : undefined} required={field.required} disabled={field.name === "officialReceiptNo" && Boolean(payment?.isFree)} />
      )}
      {fieldError ? <span id={`${fieldId}-error`} className="text-xs font-normal text-destructive" role="alert">{fieldError}</span> : null}
      {field.help ? <span className="text-xs font-normal text-muted-foreground">{field.help}</span> : null}
    </label>
  }

  async function saveDraft() {
    if (!selectedResident) {
      setFormError("Select a resident before saving this draft.")
      return
    }
    setSaving(true)
    try {
      const payload = { ...form.getValues(), residentId: selectedResident.id, residentUpdates, status: "draft" as const }
      const record = await issuanceApi.createIssuance(payload)
      onSaved(record)
      onOpenChange(false)
      resetDialog()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save the draft.")
    } finally {
      setSaving(false)
    }
  }

  async function issue() {
    if (!selectedResident) {
      setFormError("Select a resident before issuing this document.")
      return
    }
    const projectedResident = { ...selectedResident, ...residentUpdates } as ResidentRecord
    const missingResidentFields = getMissingResidentFields(projectedResident, documentType)
    if (missingResidentFields.length) {
      setFormError("Complete the resident fields listed under Needed for this document.")
      const firstMissing = missingResidentFields[0]
      window.setTimeout(() => {
        const targetId = firstMissing === "address" ? "resident-missing-address-houseNumber" : `resident-missing-${firstMissing}`
        const target = document.getElementById(targetId)
        target?.scrollIntoView({ behavior: "smooth", block: "center" })
        target?.focus()
      }, 0)
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
      setSuccessRecord(record)
      onSaved(record)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to issue this document.")
    } finally {
      setSaving(false)
    }
  }

  function hasTypedValues() {
    return form.formState.isDirty || Boolean(residentQuery.trim()) || Object.keys(residentUpdates).length > 0 ||
      (showQuickAdd && Boolean(quickAdd.firstName.trim() || quickAdd.lastName.trim() || quickAdd.birthdate || quickAdd.street.trim() || quickAdd.houseNumber.trim()))
  }

  function requestClose(nextOpen: boolean) {
    if (!nextOpen && hasTypedValues() && !window.confirm("Discard the changes to this issuance?")) return
    if (!nextOpen) resetDialog()
    onOpenChange(nextOpen)
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
  }

  async function createResident() {
    if (!quickAdd.lastName.trim() || !quickAdd.firstName.trim() || !quickAdd.birthdate || !quickAdd.purok) {
      setFormError("Surname, given names, birthdate, sex, and purok are required.")
      return
    }
    try {
      const resident = await issuanceApi.createResident(quickAdd)
      setResidents((previous) => [...previous, resident])
      selectResident(resident)
      setShowQuickAdd(false)
      setFormError("")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to add this resident.")
    }
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
      value = field.name === "isFree" ? paymentValues?.isFree ? "Yes" : "No" : paymentValues?.officialReceiptNo
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
    { label: "Resident", value: selectedResident ? formatPrintedName(selectedResident.firstName, selectedResident.middleName, selectedResident.lastName, printedNameType[documentType]) : "" },
    { label: "Resident number", value: selectedResident?.id ?? "" },
    { label: "Address", value: selectedResident ? getResidentAddress(selectedResident) : "" },
    { label: "Birthdate", value: selectedResident?.birthdate ?? "" },
    { label: "Birthplace", value: selectedResident?.birthplace ?? "" },
    { label: "Sex", value: selectedResident?.sex ?? "" },
    { label: "Civil status", value: selectedResident?.civilStatus ?? "" },
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
  const residentDone = Boolean(selectedResident) && residentMissingLabels.length === 0
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
    <DialogContent className="flex h-[94dvh] max-h-[94dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
        <DialogTitle>New Issuance</DialogTitle>
        <DialogDescription>Pick the document, find the resident, fill in the details. Everything on one screen.</DialogDescription>
      </DialogHeader>
      {successRecord ? <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center" role="status">
        <CheckCircle2 className="size-12 text-emerald-600" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold">Issued: {successRecord.referenceNo}</p>
          <p className="mt-1 text-sm text-muted-foreground">{config.name} for {selectedResident?.name ?? "the resident"} was saved. Printing remains paused until paper positions are calibrated.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" disabled><Printer className="size-4" />Print</Button>
          <Button type="button" variant="outline" onClick={issueAnother}>Issue another for this resident</Button>
          <Button type="button" onClick={() => { resetDialog(); onOpenChange(false) }}>Done</Button>
        </div>
      </div> : <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void issue() }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void issue() } }}>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-5">
            <IssuanceSection id="issuance-step-document" step={1} title="What are you issuing?" description="Click a document. The form below adapts to it." done>
              <DocumentTypePicker value={documentType} onChange={changeDocumentType} />
              <div className="grid gap-3 border-t pt-4 sm:grid-cols-[220px_1fr] sm:items-end">
                <label className={fieldLabelClass}>Date on document
                  <span className="relative">
                    <input id="issuance-date" type="date" value={issueDate} onChange={(event) => { const nextDate = event.target.value; form.setValue("issueDate", nextDate, { shouldDirty: true }); if (documentType === "BARANGAY_ID" && !validUntilEdited && nextDate) { const validDate = new Date(`${nextDate}T00:00:00`); validDate.setFullYear(validDate.getFullYear() + 1); setDetail("validUntil", localIsoDate(validDate)) } }} className={formControlClass} required />
                    <CalendarDays className="pointer-events-none absolute right-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                </label>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Printer className="size-3.5" aria-hidden="true" />{config.printMode === "overlay" ? "Prints on the pre-printed form" : "Prints as a full page"}</span>
                  {config.validityMonths ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />Valid for {config.validityMonths === 12 ? "1 year" : `${config.validityMonths} months`}</span> : null}
                  {config.onePerResident ? <span>One per resident</span> : null}
                </p>
              </div>
            </IssuanceSection>

            <IssuanceSection id="issuance-step-resident" step={2} title="Who is it for?" description="Search by name or resident number. Missing record details are filled in right here." done={residentDone}>
              {selectedResident ? <div className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{formatPrintedName(selectedResident.firstName, selectedResident.middleName, selectedResident.lastName, config.name)}</p>
                  <p className="text-xs text-muted-foreground">{selectedResident.id}</p>
                  <p className="mt-1 text-sm">{getResidentAddress(selectedResident)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedResident.birthdate ? `${calculateAge(selectedResident.birthdate, issueDate)} years old` : "Birthdate not recorded"} · {selectedResident.civilStatus || "Civil status not recorded"}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedResident(null); form.setValue("residentId", ""); setResidentQuery("") }}>Change</Button>
              </div>
            </div> : <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
                <input id="issuance-resident-search" value={residentQuery} onChange={(event) => { setResidentQuery(event.target.value); setActiveResidentMatch(0) }} onKeyDown={(event) => { if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.min(index + 1, matches.length - 1)) } if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActiveResidentMatch((index) => Math.max(index - 1, 0)) } if (event.key === "Enter" && matches[activeResidentMatch]) { event.preventDefault(); selectResident(matches[activeResidentMatch]) } if (event.key === "Escape") { event.preventDefault(); setResidentQuery("") } }} placeholder="Search name or resident number…" className={cn(formControlClass, "pl-9")} aria-label="Search resident" role="combobox" aria-autocomplete="list" aria-expanded={matches.length > 0} aria-controls="issuance-resident-results" aria-activedescendant={matches[activeResidentMatch] ? `issuance-resident-option-${matches[activeResidentMatch].id}` : undefined} />
              </div>
              {matches.length ? <div id="issuance-resident-results" role="listbox" className="overflow-hidden rounded-md border">{matches.map((resident, index) => <button type="button" key={resident.id} id={`issuance-resident-option-${resident.id}`} role="option" aria-selected={activeResidentMatch === index} disabled={resident.status === "Archived"} onMouseEnter={() => setActiveResidentMatch(index)} onClick={() => selectResident(resident)} className={cn("flex min-h-12 w-full flex-col items-start border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted", activeResidentMatch === index && "bg-muted", resident.status === "Archived" && "cursor-not-allowed opacity-50")}>
                <span className="font-medium">{resident.name} <span className="text-xs text-muted-foreground">{resident.id}</span>{resident.status === "Archived" ? <span className="ml-2 text-xs text-muted-foreground">Archived</span> : null}</span>
                <span className="text-xs text-muted-foreground">{getResidentAddress(resident)}</span>
              </button>)}</div> : residentQuery.trim() ? <p className="text-sm text-muted-foreground">No matching active resident.</p> : null}
              <button type="button" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary underline underline-offset-4" onClick={() => setShowQuickAdd((value) => !value)}><UserRoundPlus className="size-4" />Resident not found? Add new resident</button>
              {showQuickAdd ? <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {([["firstName", "Given names"], ["middleName", "Middle name"], ["lastName", "Surname"], ["birthdate", "Birthdate"], ["houseNumber", "House number"], ["street", "Street"]] as const).map(([key, label]) => <label key={key} className={fieldLabelClass}>{label}<input type={key === "birthdate" ? "date" : "text"} list={key === "street" ? "issuance-street-options" : undefined} value={quickAdd[key] ?? ""} onChange={(event) => setQuickAdd((previous) => ({ ...previous, [key]: event.target.value }))} className={formControlClass} required={["firstName", "lastName", "birthdate"].includes(key)} /></label>)}
                  <label className={fieldLabelClass}>Sex<select value={quickAdd.sex} onChange={(event) => setQuickAdd((previous) => ({ ...previous, sex: event.target.value as "Male" | "Female" }))} className={formControlClass}><option>Male</option><option>Female</option></select></label>
                  <label className={fieldLabelClass}>Civil status<select value={quickAdd.civilStatus} onChange={(event) => setQuickAdd((previous) => ({ ...previous, civilStatus: event.target.value }))} className={formControlClass}><option>Single</option><option>Married</option><option>Legally Separated</option><option>Widow/Widower</option></select></label>
                  <label className={fieldLabelClass}>Purok<select value={quickAdd.purok} onChange={(event) => setQuickAdd((previous) => ({ ...previous, purok: Number(event.target.value) }))} className={formControlClass}>{[1, 2, 3, 4, 5, 6].map((purok) => <option key={purok} value={purok}>Purok {purok}</option>)}</select></label>
                  <label className={fieldLabelClass}>Residing since<input type="number" min="1900" max={new Date().getFullYear()} value={quickAdd.residentSinceYear ?? ""} disabled={quickAdd.residentSinceBirth} onChange={(event) => setQuickAdd((previous) => ({ ...previous, residentSinceYear: event.target.value ? Number(event.target.value) : undefined }))} className={formControlClass} /></label>
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={quickAdd.residentSinceBirth} onChange={(event) => setQuickAdd((previous) => ({ ...previous, residentSinceBirth: event.target.checked, residentSinceYear: undefined }))} />Since birth</label>
                </div>
                <datalist id="issuance-street-options">{knownStreets.map((street) => <option key={street} value={street} />)}</datalist>
                <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowQuickAdd(false)}>Cancel</Button><Button type="button" onClick={() => void createResident()}>Save resident</Button></div>
              </div> : null}
            </div>}
              {selectedResident && (config.residentNeeds.some((need) => {
              const residentValue = need === "birthDate" ? selectedResident.birthdate : need === "birthPlace" ? selectedResident.birthplace : need === "civilStatus" ? selectedResident.civilStatus : need === "sex" ? selectedResident.sex : need === "residentSince" ? selectedResident.residentSinceBirth ? "since birth" : selectedResident.residentSinceBirth ? "since birth" : selectedResident.residentSince : need === "sector" ? selectedResident.sectors.length : need === "photo" ? selectedResident.photoUrl : need === "emergencyContact" ? selectedResident.emergencyContact?.name && selectedResident.emergencyContact?.address && selectedResident.emergencyContact?.phone : undefined
              return !residentValue
            }) || (!selectedResident.houseNumber?.trim() || !selectedResident.street?.trim() || !selectedResident.purok)) ? <div className="mt-3 space-y-3">
              <p className="text-sm font-medium">Needed for this document</p>
              {config.residentNeeds.filter((need) => {
                const residentValue = need === "birthDate" ? selectedResident.birthdate : need === "birthPlace" ? selectedResident.birthplace : need === "civilStatus" ? selectedResident.civilStatus : need === "sex" ? selectedResident.sex : need === "residentSince" ? selectedResident.residentSince : need === "sector" ? selectedResident.sectors.length : need === "photo" ? selectedResident.photoUrl : need === "emergencyContact" ? selectedResident.emergencyContact?.name && selectedResident.emergencyContact?.address && selectedResident.emergencyContact?.phone : undefined
                return !residentValue
              }).concat((!selectedResident.houseNumber?.trim() || !selectedResident.street?.trim() || !selectedResident.purok) ? ["address"] : []).map((need) => {
                const labels: Record<string, string> = { address: "Street and purok address", birthDate: "Birthdate", birthPlace: "Birthplace", civilStatus: "Civil status", sex: "Sex", residentSince: "Residing since year", sector: "Sector", photo: "Photo reference", emergencyContact: "Emergency contact" }
                const key = need === "birthDate" ? "birthdate" : need === "birthPlace" ? "birthplace" : need
                if (need === "residentSince") return <div key={need} className="space-y-2">
                  <label className={fieldLabelClass}>Residing since year<input id="resident-missing-residentSince" type="number" min="1900" max={new Date().getFullYear()} value={residentUpdates.residentSinceBirth ? "" : String(residentUpdates.residentSince ?? "")} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, residentSince: event.target.value ? Number(event.target.value) : undefined, residentSinceBirth: false }))} className={formControlClass} disabled={Boolean(residentUpdates.residentSinceBirth ?? selectedResident.residentSinceBirth)} /></label>
                  <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(residentUpdates.residentSinceBirth ?? selectedResident.residentSinceBirth)} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, residentSinceBirth: event.target.checked, residentSince: event.target.checked ? 0 : undefined }))} />Since birth</label>
                </div>
                if (need === "address") return <div key={need} className="space-y-2">
                  <p className="text-sm font-medium">{labels[need]}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className={fieldLabelClass}>House number<input id="resident-missing-address-houseNumber" value={addressParts.houseNumber} onChange={(event) => { const next = { ...addressParts, houseNumber: event.target.value }; setAddressParts(next); setResidentUpdates((previous) => ({ ...previous, houseNumber: next.houseNumber, street: next.street, purok: next.purok, address: [[next.houseNumber.trim(), next.street.trim()].filter(Boolean).join(" "), `Purok ${next.purok}`, "Mayondon"].filter(Boolean).join(", ") } as ResidentPatch)) }} className={formControlClass} /></label>
                    <label className={fieldLabelClass}>Street<input id="resident-missing-address-street" value={addressParts.street} onChange={(event) => { const next = { ...addressParts, street: event.target.value }; setAddressParts(next); setResidentUpdates((previous) => ({ ...previous, houseNumber: next.houseNumber, street: next.street, purok: next.purok, address: [[next.houseNumber.trim(), next.street.trim()].filter(Boolean).join(" "), `Purok ${next.purok}`, "Mayondon"].filter(Boolean).join(", ") } as ResidentPatch)) }} className={formControlClass} /></label>
                    <label className={fieldLabelClass}>Purok<select id="resident-missing-address-purok" value={addressParts.purok} onChange={(event) => { const next = { ...addressParts, purok: Number(event.target.value) }; setAddressParts(next); setResidentUpdates((previous) => ({ ...previous, houseNumber: next.houseNumber, street: next.street, purok: next.purok, address: [[next.houseNumber.trim(), next.street.trim()].filter(Boolean).join(" "), `Purok ${next.purok}`, "Mayondon"].filter(Boolean).join(", ") } as ResidentPatch)) }} className={formControlClass}>{[1, 2, 3, 4, 5, 6].map((purok) => <option key={purok} value={purok}>Purok {purok}</option>)}</select></label>
                  </div>
                </div>
                if (need === "emergencyContact") return <div key={need} className="space-y-2">
                  <p className="text-sm font-medium">{labels[need]}</p>
                  {(["name", "address", "phone"] as const).map((part) => <label key={part} className={fieldLabelClass}>{part === "phone" ? "Contact number" : part === "name" ? "Contact name" : "Contact address"}<input id={part === "name" ? "resident-missing-emergencyContact" : undefined} value={residentUpdates.emergencyContact?.[part] ?? selectedResident.emergencyContact?.[part] ?? ""} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, emergencyContact: { name: previous.emergencyContact?.name ?? selectedResident.emergencyContact?.name ?? "", address: previous.emergencyContact?.address ?? selectedResident.emergencyContact?.address ?? "", phone: previous.emergencyContact?.phone ?? selectedResident.emergencyContact?.phone ?? "", [part]: event.target.value } } as ResidentPatch))} className={formControlClass} /></label>)}
                </div>
                return <label key={need} className={fieldLabelClass}>{labels[need]}
                  {need === "civilStatus" || need === "sex" || need === "sector" ? <select value={String((residentUpdates as Record<string, unknown>)[key] ?? "")} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, [key]: need === "sector" ? [event.target.value] : event.target.value } as ResidentPatch))} className={formControlClass}><option value="">Select…</option>{(need === "civilStatus" ? ["Single", "Married", "Legally Separated", "Widow/Widower"] : need === "sex" ? ["Male", "Female"] : ["STUDENT", "Senior Citizens", "Person with Disabilities (PWD)", "Solo Parents"]).map((option) => <option key={option}>{option}</option>)}</select> :
                  <input id={`resident-missing-${need}`} type={need === "birthDate" ? "date" : "text"} value={String((residentUpdates as Record<string, unknown>)[key === "photo" ? "photoUrl" : key] ?? "")} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, [key === "photo" ? "photoUrl" : key]: need === "residentSince" && event.target.value ? Number(event.target.value) : event.target.value } as ResidentPatch))} className={formControlClass} />}
                </label>
              })}
              <p className="text-xs text-muted-foreground">Saved to the resident's record.</p>
            </div> : null}
            </IssuanceSection>

            <IssuanceSection id="issuance-step-details" step={3} title="Document details" description="Only the fields this document needs. Red asterisk means required." done={detailsDone}>
              {detailFields.length ? <div className="grid gap-4 sm:grid-cols-2">{detailFields.map(renderField)}</div> : <p className="text-sm text-muted-foreground">This document needs no extra details.</p>}
              {config.signatoryMode === "select" ? <label className={fieldLabelClass}>Signatory <span className="text-destructive">*</span><select id="issuance-signatoryOfficialId" value={form.watch("signatoryOfficialId") ?? ""} onChange={(event) => form.setValue("signatoryOfficialId", event.target.value, { shouldDirty: true })} className={cn(formControlClass, readErrorMessage(form.formState.errors.signatoryOfficialId) && "border-destructive", "bg-background")} aria-invalid={Boolean(readErrorMessage(form.formState.errors.signatoryOfficialId))} aria-describedby={readErrorMessage(form.formState.errors.signatoryOfficialId) ? "issuance-signatory-error" : undefined} required><option value="">Select official…</option>{initialOfficials.filter((official) => official.status === "Current" && ["Punong Barangay", "Barangay Kagawad", "Barangay Clerk", "Administrative Assistant", "SK Chairperson", "OIC Kagawad"].includes(official.position)).map((official) => <option key={official.id} value={official.id}>{official.name} · {official.position}</option>)}</select>{readErrorMessage(form.formState.errors.signatoryOfficialId) ? <span id="issuance-signatory-error" role="alert" className="text-xs font-normal text-destructive">{readErrorMessage(form.formState.errors.signatoryOfficialId)}</span> : null}</label> : null}
              {fieldsByGroup("more").length ? <div className="rounded-lg border border-dashed p-3">
                <button type="button" className="flex min-h-9 w-full items-center gap-2 text-sm font-medium" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}><ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />Optional extras</button>
                {!moreOpen ? <p className="mt-1 text-xs text-muted-foreground">{fieldsByGroup("more").map((field) => previewValue(field)).filter(Boolean).join(" · ") || "Nothing added. Defaults are fine for most requests."}</p> : <div className="mt-3 grid gap-4 sm:grid-cols-2">{fieldsByGroup("more").map(renderField)}</div>}
              </div> : null}
              {details.type === "FIRST_TIME_JOBSEEKER" && details.isJobstartBeneficiary ? <p className="text-sm text-muted-foreground">JobStart beneficiary selected. The Punong Barangay will determine eligibility.</p> : null}
            </IssuanceSection>

            {hasRequirements ? <IssuanceSection id="issuance-step-requirements" step={4} title={fieldsByGroup("payment").length ? "ID presented & payment" : "ID presented"} description="Copy these from the resident's ID and the official receipt." done={requirementsDone}>
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
          <div className="min-w-0 text-sm" aria-live="polite">
            {remaining ? <button type="button" onClick={goToFirstMissing} className="inline-flex min-h-9 items-center gap-1.5 text-amber-700 underline-offset-4 hover:underline"><CircleAlert className="size-4" aria-hidden="true" />{remaining} {remaining === 1 ? "item" : "items"} still needed. Go to next</button> : <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" />Ready to issue</span>}
            <span className="ml-3 hidden items-center gap-1 text-xs text-muted-foreground xl:inline-flex"><Keyboard className="size-3.5" aria-hidden="true" />Ctrl + Enter to issue</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => requestClose(false)}>Cancel</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void saveDraft()}>Save as draft</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Issue"}</Button>
          </div>
        </DialogFooter>
      </form>}
    </DialogContent>
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
