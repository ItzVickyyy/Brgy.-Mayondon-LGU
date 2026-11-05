import { AlertCircle } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { initialOfficials } from "@/components/Officials/officials-sample-data"
import type { IssuanceRecord } from "@/components/Issuances/config"
import { documentConfig, type DetailFieldConfig, type DocumentCode } from "@/components/Issuances/NewIssuance/documentConfig"
import { type MockIssuance, issuanceApi } from "@/components/Issuances/NewIssuance/issuanceApi"
import { formatPaperDate } from "@/lib/issuance-format"

type Row = { label: string; value: string }

const codeByName = Object.fromEntries(
  (Object.keys(documentConfig) as DocumentCode[]).map((code) => [documentConfig[code].name, code]),
) as Record<string, DocumentCode>

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

function officialName(id: unknown) {
  return typeof id === "string" ? initialOfficials.find((official) => official.id === id)?.name ?? "" : ""
}

/** Shows an enum-like stored value ("electric") with the same wording the form uses ("Electric"). */
function matchOption(field: DetailFieldConfig, value: string) {
  return field.options?.find((option) => option.toLowerCase() === value.toLowerCase()) ?? value
}

function stringify(field: DetailFieldConfig, value: unknown): string {
  if (value == null || value === "") return ""
  if (Array.isArray(value)) return value.map((item) => matchOption(field, String(item))).join(", ")
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (field.type === "date") return formatPaperDate(String(value))
  return matchOption(field, String(value))
}

function readField(field: DetailFieldConfig, issuance: MockIssuance, record: IssuanceRecord): string {
  const payload = issuance.payload
  const details = payload.details as unknown as Record<string, unknown>
  if (field.group === "identity") {
    const identification = payload.identification
    if (!identification) return ""
    if (field.name === "idType") return identification.idTypeId > 0 ? field.options?.[identification.idTypeId - 1] ?? "" : ""
    if (field.name === "idNumber") return identification.idNumber
    if (field.name === "idPlaceOfIssue") return identification.placeOfIssue
    return formatPaperDate(identification.dateOfIssue)
  }
  if (field.group === "payment") {
    const payment = payload.payment
    if (!payment) return ""
    if (field.name === "isFree") return payment.isFree ? "Yes" : "No"
    if (field.name === "officialReceiptNo") return payment.isFree ? "Free of charge" : payment.officialReceiptNo ?? ""
    if (field.name === "dateOfPayment") return payment.dateOfPayment ? formatPaperDate(payment.dateOfPayment) : ""
    if (field.name === "certifiedBy") return payment.certifiedBy ?? ""
    return ""
  }
  if (field.name === "healthCondition") return "Restricted"
  if (field.name === "purpose") return record.purpose || record.fields.purpose || ""
  if (field.name === "remarks") return payload.remarks ?? ""
  if (field.name === "sector") return (payload.sectors ?? []).map((sector) => field.options?.[sector.sectorId - 1] ?? "").filter(Boolean).join(", ")
  if (field.name === "sectorIdNumber") return payload.sectors?.[0]?.idNumber ?? ""
  if (field.name === "for") return details.forSelf === false ? "Someone else" : "Myself"
  if (field.name === "relationship") return stringify(field, details.beneficiaryRelationship)
  if (field.name === "witnessOfficialId") return officialName(details.witnessOfficialId)
  return stringify(field, details[field.name])
}

function Section({ step, title, children }: { step?: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
        {step ? <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-xs font-semibold text-brand">{step}</span> : null}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Rows({ rows, showEmpty = false }: { rows: Row[]; showEmpty?: boolean }) {
  const visible = showEmpty ? rows : rows.filter((row) => row.value.trim())
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">Nothing was entered.</p>
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {visible.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words font-medium">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Read-only view of an issuance. It follows the same four blocks as the New Issuance form
 * (document, resident, document details, ID and payment) and uses the same field labels.
 */
export function IssuanceDetailsView({ record }: { record: IssuanceRecord }) {
  const storedId = record.fields.mockIssuanceId
  const [issuance, setIssuance] = useState<MockIssuance | undefined>()
  const [loading, setLoading] = useState(Boolean(storedId))

  useEffect(() => {
    let cancelled = false
    setIssuance(undefined)
    setLoading(Boolean(storedId))
    if (storedId) {
      void issuanceApi.getIssuance(storedId).then((found) => {
        if (cancelled) return
        setIssuance(found)
        setLoading(false)
      })
    }
    return () => { cancelled = true }
  }, [storedId])

  const code = issuance?.documentType ?? codeByName[record.type]
  const config = code ? documentConfig[code] : undefined
  const snapshot = issuance?.residentSnapshot
  const resident = issuance ? issuanceApi.getResident(issuance.residentId) : undefined
  const fields = config?.fields ?? []
  const detailRows: Row[] = issuance ? fields.filter((field) => field.group === "main" || field.group === "more").map((field) => ({ label: field.label, value: readField(field, issuance, record) })) : []
  const requirementRows: Row[] = issuance ? fields.filter((field) => field.group === "identity" || field.group === "payment").map((field) => ({ label: field.label, value: readField(field, issuance, record) })) : []
  const signatory = issuance && config?.signatoryMode === "select" ? officialName(issuance.payload.signatoryOfficialId) || "________________________" : ""
  const hasRequirements = fields.some((field) => field.group === "identity" || field.group === "payment")

  const documentRows: Row[] = [
    { label: "Document", value: record.type },
    { label: "Reference no.", value: record.id },
    { label: "Date on document", value: record.status === "Pending" ? "" : formatPaperDate(record.date) },
    { label: "Valid until", value: record.validUntil ? formatPaperDate(record.validUntil) : "" },
    { label: "Purpose", value: record.purpose || record.fields.purpose || "" },
    ...(signatory ? [{ label: "Signatory", value: signatory }] : []),
  ]
  const residentRows: Row[] = snapshot
    ? [
        { label: "Resident", value: snapshot.fullName },
        { label: "Resident number", value: resident?.id ?? "" },
        { label: "Address", value: snapshot.addressLine },
        { label: "Birthdate", value: snapshot.birthDate ? formatPaperDate(snapshot.birthDate) : "" },
        { label: "Birthplace", value: snapshot.birthPlace ?? "" },
        { label: "Sex", value: snapshot.sex ?? "" },
        { label: "Civil status", value: snapshot.civilStatus ?? "" },
      ]
    : [{ label: "Resident", value: record.resident }]
  const historyRows: Row[] = [
    { label: "Issued by", value: record.issuedBy ? capitalize(record.issuedBy) : "" },
    { label: "Correction reason", value: record.correctionReason ?? issuance?.correctionReason ?? "" },
    { label: "Void reason", value: record.voidReason ?? issuance?.voidReason ?? "" },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={statusStyles[record.status]}>{record.status}</Badge>
        {record.status === "Pending" ? <span className="text-xs text-muted-foreground">Draft, not yet issued</span> : null}
      </div>
      <Section step={1} title="Document"><Rows rows={documentRows} /></Section>
      <Section step={2} title="Resident">
        <Rows rows={residentRows} />
        {snapshot?.photoUrl ? <img src={snapshot.photoUrl} alt="Resident portrait" className="mt-2 h-28 w-[84px] rounded-md border bg-white object-cover" /> : null}
      </Section>
      {issuance && config ? (
        <>
          {detailRows.some((row) => row.value.trim()) ? <Section step={3} title="Document details"><Rows rows={detailRows} /></Section> : null}
          {hasRequirements ? <Section step={4} title={fields.some((field) => field.group === "payment") ? "ID presented & payment" : "ID presented"}><Rows rows={requirementRows} /></Section> : null}
        </>
      ) : (
        <p className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {loading ? "Loading details…" : "Only the summary above was saved for this record. Full details are not available."}
        </p>
      )}
      {historyRows.some((row) => row.value.trim()) ? <Section title="Record history"><Rows rows={historyRows} /></Section> : null}
    </div>
  )
}
