/**
 * Turns a saved issuance into the values a print overlay template needs (round 2 of docs/HANDOFF-printing.md).
 * Pure functions only: no DOM, no network. Keys match `PrintFieldBox.key` / `PrintMarkBox.key` in templates.ts.
 */
import type { MockIssuance } from "@/components/Issuances/NewIssuance/issuanceApi"
import type { DocumentCode } from "@/components/Issuances/NewIssuance/documentConfig"
import { calculateAge, formatPaperDate, formatPrintedName, getDateParts } from "@/lib/issuance-format"
import { printTemplates, type PrintTemplateId } from "./templates"

export type PrintData = { templateId: PrintTemplateId; values: Record<string, string>; photoUrl?: string }

/** Name parts of the resident (from the resident record). Optional: without it the snapshot's full name is used as is. */
export type PrintResidentName = { firstName: string; middleName?: string; lastName: string; suffix?: string }

/** Lookup lists used by the mock API: stored ids are 1-based positions in these lists. */
export type PrintLookups = {
  sectors: string[]
  idTypes: string[]
  purposes: string[]
  tricycle?: { association: string; make: string; bodyType: string; motorNumber: string; color: string; plateNumber: string } // for FRANCHISE_CLEARANCE (payload only keeps tricycleId)
}

export const templateIdByDocumentCode: Partial<Record<DocumentCode, PrintTemplateId>> = {
  BARANGAY_CLEARANCE: "clearance",
  FRANCHISE_CLEARANCE: "franchise",
  UTILITY_CLEARANCE: "utility",
  INDIGENCY: "indigency",
  MARGINALIZED_SECTOR: "marginalized",
  ASSISTANCE: "assistance",
}

const byId = (list: string[], id?: number) => (id && id > 0 ? list[id - 1] ?? "" : "")
const cap = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "")

export function buildPrintData(issuance: MockIssuance, lookups: PrintLookups, name?: PrintResidentName): PrintData | null {
  const templateId = templateIdByDocumentCode[issuance.documentType]
  if (!templateId) return null // Residency, First-Time Jobseeker, PhilHealth, Barangay ID: no overlay template yet
  const { payload, residentSnapshot: resident, issueDate } = issuance
  const details = payload.details
  const sectors = (payload.sectors ?? []).map((sector) => byId(lookups.sectors, sector.sectorId)).filter(Boolean)
  const age = calculateAge(resident?.birthDate ?? "", issueDate)
  const dateParts = getDateParts(issueDate)

  const printedName = name
    ? formatPrintedName(name.firstName, name.middleName ?? "", name.lastName, templateId === "clearance" ? "Barangay Clearance" : "", name.suffix ?? "")
    : (resident?.fullName ?? "").trim().toUpperCase()

  const values: Record<string, string> = {
    date: formatPaperDate(issueDate),
    day: dateParts.day,
    month: dateParts.month,
    name: printedName,
    address: resident?.addressLine ?? "",
    age: age ? `${age} years old` : "",
    birthdate: resident?.birthDate ? formatPaperDate(resident.birthDate) : "",
    birthplace: resident?.birthPlace ?? "",
    civilStatus: resident?.civilStatus ?? "",
    purpose: byId(lookups.purposes, payload.purposeId),
    remarks: payload.remarks ?? "",
    remarks2: "",
    idType: byId(lookups.idTypes, payload.identification?.idTypeId),
    idNumber: payload.identification?.idNumber ?? "",
    idPlace: payload.identification?.placeOfIssue ?? "",
    idDate: payload.identification?.dateOfIssue ? formatPaperDate(payload.identification.dateOfIssue) : "",
    orNumber: payload.payment?.isFree ? "" : payload.payment?.officialReceiptNo ?? "",
    sector: sectors.join(" / "),
    sectorLine: sectors.length ? `SECTOR : ${sectors.join(" / ")}` : "",
  }

  if (details.type === "BARANGAY_CLEARANCE") values.purposeNote = details.purposeNote ?? ""
  if (details.type === "FRANCHISE_CLEARANCE") {
    if (lookups.tricycle) Object.assign(values, {
      association: lookups.tricycle.association, make: lookups.tricycle.make, bodyType: lookups.tricycle.bodyType, motorNumber: lookups.tricycle.motorNumber,
      color: lookups.tricycle.color, plateNumber: lookups.tricycle.plateNumber,
    })
  }
  if (details.type === "UTILITY_CLEARANCE") {
    values.location = details.location
    values.electric = details.services.includes("electric") ? "yes" : ""
    values.water = details.services.includes("water") ? "yes" : ""
    values.connectionType = cap(details.connectionType)
    values.classification = cap(details.classification)
  }
  if (details.type === "INDIGENCY") values.addressedTo = details.addressedToOffice
  if (details.type === "MARGINALIZED_SECTOR") values.healthCondition = details.healthCondition
  if (details.type === "ASSISTANCE") {
    values.assistanceType = cap(details.assistanceType)
    values.for = details.forSelf ? "Myself" : "Someone else"
    values.relationship = details.forSelf ? "" : details.beneficiaryRelationship ?? ""
    values.underName = details.forSelf ? "" : details.beneficiaryName ?? ""
    const since = resident?.residentSinceYear
    values.years = resident?.residentSinceBirth ? age : since ? String(Math.max(0, Number(issueDate.slice(0, 4)) - since)) : ""
  }

  // Only keep keys the template actually prints, so stray data never reaches the paper.
  const template = printTemplates[templateId]
  const printed = new Set([...template.fields.map((f) => f.key), ...(template.marks ?? []).map((m) => m.key)])
  const filtered = Object.fromEntries(Object.entries(values).filter(([key]) => printed.has(key)))
  return { templateId, values: filtered, photoUrl: template.photo ? resident?.photoUrl : undefined }
}
