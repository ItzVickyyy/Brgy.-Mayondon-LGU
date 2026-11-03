import { useMemo, useState } from "react"
import { CalendarDays, ChevronDown, Search, UserRoundPlus } from "lucide-react"
import { useNewIssuanceForm, defaultDetails, localIsoDate } from "./useNewIssuanceForm"
import { documentConfig, documentConfigList, type DetailFieldConfig, type DocumentCode } from "./documentConfig"
import { issuanceApi, type MockIssuance, type QuickResidentInput, type ResidentPatch } from "./issuanceApi"
import { sampleResidents, type ResidentRecord } from "@/components/Records/records-sample-data"
import { calculateAge, formatPrintedName } from "@/lib/issuance-format"
import { formControlClass } from "@/components/Common/formStyles"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialResidentId?: string
  onSaved: (record: MockIssuance) => void
}

const sectionClass = "space-y-3 border-b pb-5 last:border-b-0"
const fieldLabelClass = "flex min-w-0 flex-col gap-1.5 text-sm font-medium"

function normalizedOptionValue(fieldName: string, option: string) {
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
  const [selectedResident, setSelectedResident] = useState<ResidentRecord | null>(() => sampleResidents.find((resident) => resident.id === initialResidentId || resident.name === initialResidentId) ?? null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAdd, setQuickAdd] = useState<QuickResidentInput>({
    lastName: "", firstName: "", middleName: "", birthdate: "", sex: "Male", civilStatus: "Single",
    houseNumber: "", street: "", purok: 1, residentSinceBirth: false,
  })
  const [residentUpdates, setResidentUpdates] = useState<ResidentPatch>({})
  const [selectedSector, setSelectedSector] = useState("")
  const [addressParts, setAddressParts] = useState({ houseNumber: "", street: "", purok: 1 })
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

  function changeDocumentType(nextCode: DocumentCode) {
    const current = form.getValues()
    const detailsDirty = Object.entries(current.details as unknown as Record<string, unknown>).some(([key, value]) => {
      const defaults = defaultDetails(current.documentType) as unknown as Record<string, unknown>
      return JSON.stringify(value) !== JSON.stringify(defaults[key])
    }) || Boolean(current.purposeText?.trim()) || Boolean(current.identification?.idNumber?.trim()) || Boolean(current.payment?.officialReceiptNo?.trim())
    if (detailsDirty && !window.confirm("Changing the document type will clear its details. Continue?")) return
    form.setValue("documentType", nextCode, { shouldDirty: true })
    form.setValue("details", defaultDetails(nextCode), { shouldDirty: true })
    form.setValue("purposeText", "")
    form.setValue("remarks", nextCode === "BARANGAY_CLEARANCE" ? "NO DEROGATORY RECORD ON FILE" : "")
    form.setValue("identification", nextCode === "BARANGAY_CLEARANCE" || nextCode === "FRANCHISE_CLEARANCE" || nextCode === "UTILITY_CLEARANCE"
      ? { idTypeId: nextCode === "BARANGAY_CLEARANCE" ? 2 : 1, idNumber: "", placeOfIssue: "Los Baños, Laguna", dateOfIssue: localIsoDate() }
      : undefined)
    form.setValue("payment", ["BARANGAY_CLEARANCE", "FRANCHISE_CLEARANCE", "UTILITY_CLEARANCE"].includes(nextCode)
      ? { officialReceiptNo: "", isFree: false } : undefined)
    form.clearErrors()
    setSelectedSector("")
    setAddressParts({ houseNumber: "", street: "", purok: 1 })
    setDuplicate(null)
    setFormError("")
  }

  function selectResident(resident: ResidentRecord) {
    if (resident.status === "Archived") return
    setSelectedResident(resident)
    setResidentQuery("")
    form.setValue("residentId", resident.id, { shouldDirty: true })
    setResidentUpdates({})
    setSelectedSector("")
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

  function renderField(field: DetailFieldConfig) {
    const fieldId = `issuance-${field.name}`
    const fieldValue = field.group === "identity"
      ? (identification as unknown as Record<string, unknown> | undefined)?.[field.name === "idType" ? "idTypeId" : field.name === "idNumber" ? "idNumber" : field.name === "idPlaceOfIssue" ? "placeOfIssue" : "dateOfIssue"]
      : field.group === "payment"
        ? (payment as unknown as Record<string, unknown> | undefined)?.[field.name === "officialReceiptNo" ? "officialReceiptNo" : "isFree"]
        : field.name === "purpose" ? form.watch("purposeText")
        : field.name === "remarks" ? form.watch("remarks")
        : field.name === "sector" ? selectedSector
        : field.name === "for" ? ((details as unknown as Record<string, unknown>).forSelf === false ? "Someone else" : "Myself")
        : field.name === "relationship" ? (details as unknown as Record<string, unknown>).beneficiaryRelationship
        : field.name === "sectorIdNumber" ? form.watch("sectors")?.[0]?.idNumber ?? ""
        : (details as unknown as Record<string, unknown>)[field.name]
    const value = fieldValue ?? getDefaultToday(field.default)
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
      else if (field.name === "remarks") setRootField("remarks", String(nextValue))
      else if (field.name === "sector") { setSelectedSector(String(nextValue)); form.setValue("sectors", [{ sectorId: Math.max(1, (field.options ?? []).indexOf(String(nextValue)) + 1) }], { shouldDirty: true }) }
      else if (field.name === "for") setDetail("forSelf", nextValue === "Myself")
      else if (field.name === "relationship") setDetail("beneficiaryRelationship", String(nextValue))
      else if (field.name === "isJobstartBeneficiary") setDetail(field.name, nextValue === "true")
      else if (["services", "connectionType", "classification", "assistanceType", "transactionType"].includes(field.name)) {
        setDetail(field.name, Array.isArray(nextValue) ? nextValue : String(nextValue).toLowerCase())
      } else if (field.name === "sectorIdNumber") {
        form.setValue("sectors", [{ sectorId: form.getValues("sectors")?.[0]?.sectorId ?? 1, idNumber: String(nextValue) }], { shouldDirty: true })
      } else setDetail(field.name, nextValue)
    }
    return <label key={field.name} htmlFor={fieldId} className={fieldLabelClass}>
      <span>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</span>
      {field.type === "select" || field.type === "combobox" || field.type === "radio" ? (
        <select id={fieldId} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, "bg-background")} required={field.required}>
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => <option key={option} value={normalizedOptionValue(field.name, option)}>{option}</option>)}
        </select>
      ) : field.type === "multiselect" ? (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => {
            const current = Array.isArray(value) ? value as string[] : []
            const optionValue = normalizedOptionValue(field.name, option)
            return <label key={option} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-normal">
              <input type="checkbox" checked={current.includes(optionValue)} onChange={(event) => onValueChange(event.target.checked ? [...current, optionValue] as unknown as string : current.filter((item) => item !== optionValue) as unknown as string)} />
              {option}
            </label>
          })}
        </div>
      ) : field.type === "checkbox" ? (
        <input id={fieldId} type="checkbox" checked={Boolean(value)} onChange={(event) => onValueChange(event.target.checked)} className="size-4 accent-primary" />
      ) : field.type === "textarea" ? (
        <textarea id={fieldId} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={cn(formControlClass, "h-auto py-2")} rows={2} />
      ) : (
        <input id={fieldId} type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"} value={String(value)} onChange={(event) => onValueChange(event.target.value)} className={formControlClass} required={field.required} disabled={field.name === "officialReceiptNo" && Boolean(payment?.isFree)} />
      )}
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
      const parsed = form.trigger()
      const valid = await parsed
      if (!valid) {
        setFormError("Check the required fields marked above.")
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

  function resetDialog() {
    form.reset()
    setSelectedResident(null)
    setResidentQuery("")
    setResidentUpdates({})
    setSelectedSector("")
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
  const previewRows = [
    ["Resident", selectedResident ? formatPrintedName(selectedResident.firstName, selectedResident.middleName, selectedResident.lastName, config.name) : ""],
    ["Address", selectedResident?.address ?? ""],
    ["Date", issueDate],
    ["Purpose", form.watch("purposeText") ?? ""],
  ]

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && form.formState.isDirty && !window.confirm("Discard the changes to this issuance?")) return; if (!nextOpen) resetDialog(); onOpenChange(nextOpen) }}>
    <DialogContent className="flex max-h-[96dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
        <DialogTitle>New Issuance</DialogTitle>
        <DialogDescription>Complete the document details. Printing is currently paused.</DialogDescription>
      </DialogHeader>
      {successRecord ? <div className="space-y-4 overflow-y-auto p-5" role="status">
        <p className="font-semibold">Saved as issued: {successRecord.referenceNo}</p>
        <p className="text-sm text-muted-foreground">The issuance record was saved. Printing remains paused until paper positions are calibrated.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled>Print</Button>
          <Button type="button" onClick={() => { resetDialog(); onOpenChange(false) }}>Done</Button>
        </div>
      </div> : <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void issue() }}>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className={sectionClass}>
            <h3 className="text-sm font-semibold">Document</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={fieldLabelClass}>Type of document
                <select value={documentType} onChange={(event) => changeDocumentType(event.target.value as DocumentCode)} className={cn(formControlClass, "bg-background")}>
                  {(["clearance", "certification", "id"] as const).map((category) => <optgroup key={category} label={category === "id" ? "ID" : category === "clearance" ? "Clearances" : "Certifications"}>
                    {documentConfigList.filter((item) => item.category === category).map((item) => <option key={item.code} value={item.code}>{item.shortName}</option>)}
                  </optgroup>)}
                </select>
                <span className="text-xs font-normal text-muted-foreground">{config.hint}</span>
              </label>
              <label className={fieldLabelClass}>Date on document
                <span className="relative">
                  <input type="date" value={issueDate} onChange={(event) => form.setValue("issueDate", event.target.value, { shouldDirty: true })} className={formControlClass} required />
                  <CalendarDays className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-semibold">Resident</h3>
            {selectedResident ? <div className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{formatPrintedName(selectedResident.firstName, selectedResident.middleName, selectedResident.lastName, config.name)}</p>
                  <p className="text-xs text-muted-foreground">{selectedResident.id}</p>
                  <p className="mt-1 text-sm">{selectedResident.address}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedResident.birthdate ? `${calculateAge(selectedResident.birthdate, issueDate)} years old` : "Birthdate not recorded"} · {selectedResident.civilStatus || "Civil status not recorded"}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedResident(null); form.setValue("residentId", ""); setResidentQuery("") }}>Change</Button>
              </div>
            </div> : <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
                <input value={residentQuery} onChange={(event) => setResidentQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); selectResident(matches[0]) } if (event.key === "Escape") setResidentQuery("") }} placeholder="Search name or resident number…" className={cn(formControlClass, "pl-9")} aria-label="Search resident" />
              </div>
              {matches.length ? <div className="overflow-hidden rounded-md border">{matches.map((resident) => <button type="button" key={resident.id} disabled={resident.status === "Archived"} onClick={() => selectResident(resident)} className={cn("flex min-h-12 w-full flex-col items-start border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted", resident.status === "Archived" && "cursor-not-allowed opacity-50")}>
                <span className="font-medium">{resident.name} <span className="text-xs text-muted-foreground">{resident.id}</span>{resident.status === "Archived" ? <span className="ml-2 text-xs text-muted-foreground">Archived</span> : null}</span>
                <span className="text-xs text-muted-foreground">{resident.address}</span>
              </button>)}</div> : residentQuery.trim() ? <p className="text-sm text-muted-foreground">No matching active resident.</p> : null}
              <button type="button" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary underline underline-offset-4" onClick={() => setShowQuickAdd((value) => !value)}><UserRoundPlus className="size-4" />Resident not found? Add new resident</button>
              {showQuickAdd ? <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {([["firstName", "Given names"], ["middleName", "Middle name"], ["lastName", "Surname"], ["birthdate", "Birthdate"], ["houseNumber", "House number"], ["street", "Street"]] as const).map(([key, label]) => <label key={key} className={fieldLabelClass}>{label}<input type={key === "birthdate" ? "date" : "text"} value={quickAdd[key] ?? ""} onChange={(event) => setQuickAdd((previous) => ({ ...previous, [key]: event.target.value }))} className={formControlClass} required={["firstName", "lastName", "birthdate"].includes(key)} /></label>)}
                  <label className={fieldLabelClass}>Sex<select value={quickAdd.sex} onChange={(event) => setQuickAdd((previous) => ({ ...previous, sex: event.target.value as "Male" | "Female" }))} className={formControlClass}><option>Male</option><option>Female</option></select></label>
                  <label className={fieldLabelClass}>Civil status<select value={quickAdd.civilStatus} onChange={(event) => setQuickAdd((previous) => ({ ...previous, civilStatus: event.target.value }))} className={formControlClass}><option>Single</option><option>Married</option><option>Legally Separated</option><option>Widow/Widower</option></select></label>
                  <label className={fieldLabelClass}>Purok<select value={quickAdd.purok} onChange={(event) => setQuickAdd((previous) => ({ ...previous, purok: Number(event.target.value) }))} className={formControlClass}>{[1, 2, 3, 4, 5, 6].map((purok) => <option key={purok} value={purok}>Purok {purok}</option>)}</select></label>
                  <label className={fieldLabelClass}>Residing since<input type="number" min="1900" max={new Date().getFullYear()} value={quickAdd.residentSinceYear ?? ""} disabled={quickAdd.residentSinceBirth} onChange={(event) => setQuickAdd((previous) => ({ ...previous, residentSinceYear: event.target.value ? Number(event.target.value) : undefined }))} className={formControlClass} /></label>
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={quickAdd.residentSinceBirth} onChange={(event) => setQuickAdd((previous) => ({ ...previous, residentSinceBirth: event.target.checked, residentSinceYear: undefined }))} />Since birth</label>
                </div>
                <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowQuickAdd(false)}>Cancel</Button><Button type="button" onClick={() => void createResident()}>Save resident</Button></div>
              </div> : null}
            </div>}
            {selectedResident && (config.residentNeeds.some((need) => {
              const residentValue = need === "birthDate" ? selectedResident.birthdate : need === "birthPlace" ? selectedResident.birthplace : need === "civilStatus" ? selectedResident.civilStatus : need === "sex" ? selectedResident.sex : need === "residentSince" ? selectedResident.residentSince : need === "sector" ? selectedResident.sectors.length : need === "photo" ? selectedResident.photoUrl : selectedResident.emergencyContact?.phone
              return !residentValue
            }) || !selectedResident.address.trim()) ? <div className="mt-3 space-y-3">
              <p className="text-sm font-medium">Needed for this document</p>
              {config.residentNeeds.filter((need) => {
                const residentValue = need === "birthDate" ? selectedResident.birthdate : need === "birthPlace" ? selectedResident.birthplace : need === "civilStatus" ? selectedResident.civilStatus : need === "sex" ? selectedResident.sex : need === "residentSince" ? selectedResident.residentSince : need === "sector" ? selectedResident.sectors.length : need === "photo" ? selectedResident.photoUrl : selectedResident.emergencyContact?.phone
                return !residentValue
              }).concat(!selectedResident.address.trim() ? ["address"] : []).map((need) => {
                const labels: Record<string, string> = { address: "Street and purok address", birthDate: "Birthdate", birthPlace: "Birthplace", civilStatus: "Civil status", sex: "Sex", residentSince: "Residing since year", sector: "Sector", photo: "Photo reference", emergencyContact: "Emergency contact" }
                const key = need === "birthDate" ? "birthdate" : need === "birthPlace" ? "birthplace" : need
                if (need === "address") return <div key={need} className="space-y-2">
                  <p className="text-sm font-medium">{labels[need]}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className={fieldLabelClass}>House number<input value={addressParts.houseNumber} onChange={(event) => { const next = { ...addressParts, houseNumber: event.target.value }; setAddressParts(next); setResidentUpdates((previous) => ({ ...previous, address: [next.houseNumber.trim(), next.street.trim(), `Purok ${next.purok}`].filter(Boolean).join(", ") } as ResidentPatch)) }} className={formControlClass} /></label>
                    <label className={fieldLabelClass}>Street<input value={addressParts.street} onChange={(event) => { const next = { ...addressParts, street: event.target.value }; setAddressParts(next); setResidentUpdates((previous) => ({ ...previous, address: [next.houseNumber.trim(), next.street.trim(), `Purok ${next.purok}`].filter(Boolean).join(", ") } as ResidentPatch)) }} className={formControlClass} /></label>
                    <label className={fieldLabelClass}>Purok<select value={addressParts.purok} onChange={(event) => { const next = { ...addressParts, purok: Number(event.target.value) }; setAddressParts(next); setResidentUpdates((previous) => ({ ...previous, address: [next.houseNumber.trim(), next.street.trim(), `Purok ${next.purok}`].filter(Boolean).join(", ") } as ResidentPatch)) }} className={formControlClass}>{[1, 2, 3, 4, 5, 6].map((purok) => <option key={purok} value={purok}>Purok {purok}</option>)}</select></label>
                  </div>
                </div>
                if (need === "emergencyContact") return <div key={need} className="space-y-2">
                  <p className="text-sm font-medium">{labels[need]}</p>
                  {(["name", "address", "phone"] as const).map((part) => <label key={part} className={fieldLabelClass}>{part === "phone" ? "Contact number" : part === "name" ? "Contact name" : "Contact address"}<input value={residentUpdates.emergencyContact?.[part] ?? selectedResident.emergencyContact?.[part] ?? ""} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, emergencyContact: { name: previous.emergencyContact?.name ?? selectedResident.emergencyContact?.name ?? "", address: previous.emergencyContact?.address ?? selectedResident.emergencyContact?.address ?? "", phone: previous.emergencyContact?.phone ?? selectedResident.emergencyContact?.phone ?? "", [part]: event.target.value } } as ResidentPatch))} className={formControlClass} /></label>)}
                </div>
                return <label key={need} className={fieldLabelClass}>{labels[need]}
                  {need === "civilStatus" || need === "sex" || need === "sector" ? <select value={String((residentUpdates as Record<string, unknown>)[key] ?? "")} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, [key]: need === "sector" ? [event.target.value] : event.target.value } as ResidentPatch))} className={formControlClass}><option value="">Select…</option>{(need === "civilStatus" ? ["Single", "Married", "Legally Separated", "Widow/Widower"] : need === "sex" ? ["Male", "Female"] : ["STUDENT", "Senior Citizens", "Person with Disabilities (PWD)", "Solo Parents"]).map((option) => <option key={option}>{option}</option>)}</select> :
                  <input type={need === "birthDate" ? "date" : "text"} value={String((residentUpdates as Record<string, unknown>)[key === "photo" ? "photoUrl" : key] ?? "")} onChange={(event) => setResidentUpdates((previous) => ({ ...previous, [key === "photo" ? "photoUrl" : key]: need === "residentSince" && event.target.value ? Number(event.target.value) : event.target.value } as ResidentPatch))} className={formControlClass} />}
                </label>
              })}
              <p className="text-xs text-muted-foreground">Saved to the resident's record.</p>
            </div> : null}
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-semibold">Details</h3>
            <p className="text-xs text-muted-foreground">* required</p>
            {fieldsByGroup("main").length ? <div className="grid gap-3 sm:grid-cols-2">{fieldsByGroup("main").map(renderField)}</div> : null}
            {fieldsByGroup("identity").length ? <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Proof of identity</p><div className="grid gap-3 sm:grid-cols-2">{fieldsByGroup("identity").map(renderField)}</div></div> : null}
            {fieldsByGroup("payment").length ? <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Payment</p><div className="grid gap-3 sm:grid-cols-2">{fieldsByGroup("payment").map(renderField)}</div></div> : null}
            {fieldsByGroup("more").length ? <div>
              <button type="button" className="flex min-h-10 items-center gap-2 text-sm font-medium" onClick={() => setMoreOpen((value) => !value)}><ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />More options (optional)</button>
              {!moreOpen ? <p className="text-xs text-muted-foreground">{fieldsByGroup("more").map((field) => String((details as unknown as Record<string, unknown>)[field.name] ?? "")).filter(Boolean).join(" · ") || "No optional details added"}</p> : <div className="grid gap-3 sm:grid-cols-2">{fieldsByGroup("more").map(renderField)}</div>}
            </div> : null}
            <div>
              <button type="button" className="flex min-h-10 items-center gap-2 text-sm font-medium" onClick={() => setPreviewOpen((value) => !value)}><ChevronDown className={cn("size-4 transition-transform", previewOpen && "rotate-180")} />Preview of what will print</button>
              {previewOpen ? <div className="space-y-2 rounded-md border p-3 text-sm">{previewRows.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2"><span className="text-muted-foreground">{label}</span><span className="break-words text-right">{value || "Missing"}</span></div>)}<p className="border-t pt-2 text-xs text-muted-foreground">Preview only. Printing is paused pending paper calibration.</p></div> : null}
            </div>
          </section>
          {duplicate ? <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">An issued First-Time Jobseeker certificate already exists: {duplicate.referenceNo}, dated {duplicate.issueDate}. An administrator must void it before another can be issued.</p> : null}
          {details.type === "FIRST_TIME_JOBSEEKER" && details.isJobstartBeneficiary ? <p className="text-sm text-muted-foreground">JobStart beneficiary selected. The Punong Barangay will determine eligibility.</p> : null}
          {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
        </div>
        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button type="button" variant="ghost" onClick={() => { if (form.formState.isDirty && !window.confirm("Discard the changes to this issuance?")) return; resetDialog(); onOpenChange(false) }}>Cancel</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => void saveDraft()}>Save as draft</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Issue"}</Button>
        </DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>
}
