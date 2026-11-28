/**
 * Turns a saved issuance into the values a print overlay template needs (see docs/04-Documents-and-Printing.md section 6).
 * Pure functions only: no DOM, no network. Keys match `PrintFieldBox.key` / `PrintMarkBox.key` in templates.ts.
 */

import type { DocumentCode } from "@/components/Issuances/NewIssuance/documentConfig"
import type { MockIssuance } from "@/components/Issuances/NewIssuance/issuanceApi"
import {
  calculateAge,
  formatPaperDate,
  formatPrintedName,
  getDateParts,
} from "@/lib/issuance-format"
import { type PrintTemplateId, printTemplates } from "./templates"

export type PrintData = {
  templateId: PrintTemplateId
  values: Record<string, string>
  photoUrl?: string
}

/** Name parts of the resident (from the resident record). Optional: without it the snapshot's full name is used as is. */
export type PrintResidentName = {
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
}

/** One saved list entry: the id an issuance stores, and the name that is printed. */
export type LookupName = { id: number; name: string }

/** Lookup lists with their real ids. A name is found by id, never by its place in the list, so a removed item leaves no gap that shifts the others. */
export type PrintLookups = {
  sectors: LookupName[]
  idTypes: LookupName[]
  purposes: LookupName[]
  /** Current officials, for the signatory of Residency and First-Time Jobseeker (an official that is no longer current is left blank for handwriting). */
  officials?: { id: string; name: string; position: string }[]
  tricycle?: {
    association: string
    make: string
    bodyType: string
    motorNumber: string
    color: string
    plateNumber: string
  } // for FRANCHISE_CLEARANCE (payload only keeps tricycleId)
}

/** Names are the same person when the first and the last words match, ignoring case, accents, punctuation, "HON.", suffixes and middle initials ("Mark Dennis A. Concio" = "MARK DENNIS CONCIO"). */
export function isSamePerson(a: string, b: string): boolean {
  const words = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z\s]/g, " ")
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 1 && !["HON", "JR", "SR", "II", "III"].includes(word),
      )
  const first = words(a)
  const second = words(b)
  if (first.length < 2 || second.length < 2) return false
  return (
    first[0] === second[0] &&
    first[first.length - 1] === second[second.length - 1]
  )
}

export const templateIdByDocumentCode: Partial<
  Record<DocumentCode, PrintTemplateId>
> = {
  BARANGAY_CLEARANCE: "clearance",
  FRANCHISE_CLEARANCE: "franchise",
  UTILITY_CLEARANCE: "utility",
  INDIGENCY: "indigency",
  ASSISTANCE: "assistance",
  RESIDENCY: "residency",
  FIRST_TIME_JOBSEEKER: "jobseeker",
}

const byId = (list: LookupName[], id?: number) =>
  id && id > 0 ? (list.find((item) => item.id === id)?.name ?? "") : ""
const cap = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : ""

/** "2026-09-15" -> "09/15/2026", the way the stamp box reads in Clearance Issuing.xls. */
function slashDate(iso?: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "")
  return match ? `${match[2]}/${match[3]}/${match[1]}` : ""
}

/** 1 -> "1st", 22 -> "22nd", 13 -> "13th": the form reads "this ___ day of". */
export function ordinal(day: string): string {
  const n = Number(day)
  if (!Number.isInteger(n) || n < 1) return ""
  const teen = n % 100 >= 11 && n % 100 <= 13
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`
}

/**
 * Splits text into at most `maxLines` lines of about `limits[i]` characters (the last limit repeats).
 * Words are not broken; whatever does not fit stays on the last line, where the printer shrinks it to the box.
 */
export function wrapLines(
  text: string,
  limits: number[],
  maxLines: number,
): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const limit = limits[Math.min(lines.length, limits.length - 1)] ?? 80
    const next = line ? `${line} ${word}` : word
    if (line && next.length > limit && lines.length < maxLines - 1) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** "19 years": the printed value carries its own unit, because the forms leave it out. */
function yearsText(years: number): string {
  if (years < 1) return "Less than 1 year"
  return years === 1 ? "1 year" : `${years} years`
}

export function buildPrintData(
  issuance: MockIssuance,
  lookups: PrintLookups,
  name?: PrintResidentName,
): PrintData | null {
  const templateId = templateIdByDocumentCode[issuance.documentType]
  if (!templateId) return null // Barangay ID: no overlay template yet
  const { payload, residentSnapshot: resident, issueDate } = issuance
  const details = payload.details
  const sectors = (payload.sectors ?? [])
    .map((sector) => byId(lookups.sectors, sector.sectorId))
    .filter(Boolean)
  const age = calculateAge(resident?.birthDate ?? "", issueDate)
  const dateParts = getDateParts(issueDate)

  const printedName = name
    ? formatPrintedName(
        name.firstName,
        name.middleName ?? "",
        name.lastName,
        templateId === "clearance" ? "Barangay Clearance" : "",
        name.suffix ?? "",
      )
    : (resident?.fullName ?? "").trim().toUpperCase()

  const values: Record<string, string> = {
    date: formatPaperDate(issueDate),
    day: dateParts.day,
    dayOrdinal: ordinal(dateParts.day),
    month: dateParts.month,
    yearShort: issueDate.slice(2, 4),
    name: printedName,
    address: resident?.addressLine ?? "",
    age: age ? `${age} years old` : "",
    ageNumber: age,
    birthdate: resident?.birthDate ? formatPaperDate(resident.birthDate) : "",
    birthplace: resident?.birthPlace ?? "",
    civilStatus: resident?.civilStatus ?? "",
    purpose: byId(lookups.purposes, payload.purposeId),
    remarks: payload.remarks ?? "",
    // Clearance Issuing.xls prints this line between PURPOSE and REMARKS. The New Issuance form has no box for it, so it follows the purpose: printed unless the purpose is a loan.
    purposeNote:
      templateId === "clearance" &&
      byId(lookups.purposes, payload.purposeId) &&
      !/loan/i.test(byId(lookups.purposes, payload.purposeId))
        ? "NOT APPLICABLE FOR LOAN PURPOSES"
        : "",
    idType: byId(lookups.idTypes, payload.identification?.idTypeId),
    idNumber: payload.identification?.idNumber ?? "",
    idPlace: payload.identification?.placeOfIssue ?? "",
    idDate: payload.identification?.dateOfIssue
      ? formatPaperDate(payload.identification.dateOfIssue)
      : "",
    // "Paid under OFFICIAL RECEIPT No." of the Barangay Clearance, the Franchise Clearance and the Electrical/Water (Utility) Clearance reads FOC when the certificate is free (Clearance Issuing.xls, BRGY CLEARANCE; Franchise added by the owner in patch 340); the other forms leave it blank.
    orNumber: payload.payment?.isFree
      ? templateId === "clearance" ||
        templateId === "franchise" ||
        templateId === "utility"
        ? "FOC"
        : ""
      : (payload.payment?.officialReceiptNo ?? ""),
    // "DOCUMENTARY STAMP TAX PAID" box (clearances only): a free certificate reads FOC, as on the barangay's own sample.
    stampOr: payload.payment?.isFree
      ? "FOC"
      : (payload.payment?.officialReceiptNo ?? ""),
    stampDate: slashDate(payload.payment?.dateOfPayment),
    stampBy: payload.payment?.certifiedBy ?? "",
    sector: sectors.join(" / "),
    sectorLabel: sectors.length ? "SECTOR" : "",
    sectorColon: sectors.length ? ":" : "",
  }

  if (details.type === "FRANCHISE_CLEARANCE") {
    if (lookups.tricycle)
      Object.assign(values, {
        association: lookups.tricycle.association,
        make: lookups.tricycle.make,
        bodyType: lookups.tricycle.bodyType,
        motorNumber: lookups.tricycle.motorNumber,
        color: lookups.tricycle.color,
        plateNumber: lookups.tricycle.plateNumber,
      })
  }
  if (details.type === "UTILITY_CLEARANCE") {
    values.location = details.location
    values.electric = details.services.includes("electric") ? "yes" : ""
    values.water = details.services.includes("water") ? "yes" : ""
    values.connectionType = cap(details.connectionType)
    values.classification = cap(details.classification)
  }
  if (details.type === "INDIGENCY")
    values.addressedTo = details.addressedToOffice
  if (details.type === "ASSISTANCE") {
    values.assistanceType = cap(details.assistanceType)
    values.for = details.forSelf ? "Myself" : "Someone else"
    values.relationship = details.forSelf
      ? ""
      : (details.beneficiaryRelationship ?? "")
    values.underName = details.forSelf ? "" : (details.beneficiaryName ?? "")
    const since = resident?.residentSinceYear
    values.years = resident?.residentSinceBirth
      ? age
      : since
        ? String(Math.max(0, Number(issueDate.slice(0, 4)) - since))
        : ""
  }

  if (details.type === "RESIDENCY") {
    values.since = resident?.residentSinceBirth
      ? "birth"
      : resident?.residentSinceYear
        ? String(resident.residentSinceYear)
        : ""
    // The barangay's own sample prints FOC where the receipt number goes when the certificate is free.
    values.orNumber = payload.payment?.isFree
      ? "FOC"
      : (payload.payment?.officialReceiptNo ?? "")
    values.idPresented = [values.idType, values.idNumber]
      .filter(Boolean)
      .join(": ")
    // Up to 500 characters, typed in six lines because the form has no ruled lines there.
    wrapLines(details.additionalStatement ?? "", [96], 6).forEach(
      (line, index) => {
        values[`statement${index + 1}`] = line
      },
    )
  }
  if (details.type === "FIRST_TIME_JOBSEEKER") {
    const years = resident?.residentSinceBirth
      ? Number(age)
      : resident?.residentSinceYear
        ? Number(issueDate.slice(0, 4)) - resident.residentSinceYear
        : undefined
    values.yearsResident =
      years === undefined || Number.isNaN(years)
        ? ""
        : yearsText(Math.max(0, years))
    values.sex = resident?.sex ?? ""
    values.educationalAttainment = details.educationalAttainment
    values.course = details.course
    values.jobstart = details.isJobstartBeneficiary ? "yes" : "no"
    // "Witnessed by:" on the Oath and the Certification: the person who issued the document, in capitals as in the barangay's filled certifications. An older record that kept an official instead of a name uses that official when still current. No designation is printed because an account has no position.
    const legacyWitness = lookups.officials?.find(
      (item) => item.id === details.legacyWitnessOfficialId,
    )
    values.witnessName = (
      details.witnessName?.trim() ||
      legacyWitness?.name ||
      ""
    ).toUpperCase()
    // "Barangay Official/Designation/Position": accounts have no position, so it is the position of the current official whose name is the witness's (the barangay's clerk and administrative assistant are on the Officials list). No match leaves it blank for handwriting.
    values.witnessDesignation =
      legacyWitness && !details.witnessName?.trim()
        ? legacyWitness.position
        : (lookups.officials?.find((item) =>
            isSamePerson(item.name, details.witnessName ?? ""),
          )?.position ?? "")
    wrapLines(resident?.addressLine ?? "", [48, 66, 66], 3).forEach(
      (line, index) => {
        values[`addressLine${index + 1}`] = line
      },
    )
  }
  if (details.type === "RESIDENCY" || details.type === "FIRST_TIME_JOBSEEKER") {
    const official = lookups.officials?.find(
      (item) => item.id === payload.signatoryOfficialId,
    )
    if (official) {
      const upper = official.name.trim().toUpperCase()
      values.signatoryName = /^HON\.?\s/.test(upper) ? upper : `HON. ${upper}`
      values.signatoryPosition = official.position
    }
  }

  // Only keep keys the template actually prints, so stray data never reaches the paper.
  const template = printTemplates[templateId]
  const printed = new Set([
    ...template.fields.map((f) => f.key),
    ...(template.marks ?? []).map((m) => m.key),
    ...(template.stamp ? ["stampOr", "stampDate", "stampBy"] : []),
  ])
  const filtered = Object.fromEntries(
    Object.entries(values).filter(([key]) => printed.has(key)),
  )
  return {
    templateId,
    values: filtered,
    photoUrl: template.photo ? resident?.photoUrl : undefined,
  }
}
