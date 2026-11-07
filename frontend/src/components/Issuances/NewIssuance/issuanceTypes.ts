import type { ResidentRecord } from "@/components/Records/records-sample-data"
import { type DocumentCode, documentConfig } from "./documentConfig"
import type { DocumentDetails, IssuanceInput } from "./schemas"

export type ResidentPatch = Partial<
  Pick<
    ResidentRecord,
    | "name"
    | "firstName"
    | "middleName"
    | "lastName"
    | "suffix"
    | "birthdate"
    | "birthplace"
    | "sex"
    | "civilStatus"
    | "sectors"
    | "residentSince"
    | "residentSinceBirth"
    | "address"
    | "houseNumber"
    | "street"
    | "purok"
    | "idNumber"
    | "photoUrl"
    | "emergencyContact"
  >
>
export type QuickResidentInput = {
  lastName: string
  firstName: string
  middleName?: string
  suffix?: string
  birthdate: string
  birthplace?: string
  sex: "Male" | "Female" | ""
  civilStatus: string
  houseNumber?: string
  street: string
  purok: number
  residentSinceYear?: number
  residentSinceBirth: boolean
  photoUrl?: string
}
export type IssuanceStatus = "draft" | "issued" | "voided"
export type StoredDocumentDetails =
  | Exclude<
      DocumentDetails,
      { type: "FIRST_TIME_JOBSEEKER" | "FRANCHISE_CLEARANCE" }
    >
  | { type: "FRANCHISE_CLEARANCE"; tricycleId?: string }
  | Omit<Extract<DocumentDetails, { type: "FIRST_TIME_JOBSEEKER" }>, "parts">
export type StoredIssuancePayload = Omit<
  IssuanceInput,
  "residentUpdates" | "purposeText" | "details"
> & {
  purposeId?: number
  details: StoredDocumentDetails
}

export type MockIssuance = {
  id: string
  referenceNo: string
  documentType: DocumentCode
  residentId: string
  issueDate: string
  status: IssuanceStatus
  payload: StoredIssuancePayload
  correctsIssuanceId?: string
  correctionReason?: string
  voidReason?: string
  residentSnapshot?: {
    fullName: string
    addressLine: string
    birthDate?: string
    birthPlace?: string
    sex?: string
    civilStatus?: string
    photoUrl?: string
    residentSinceYear?: number
    residentSinceBirth: boolean
  }
  issuedAt?: string
}
export type IssuanceLookups = {
  documentTypes: (typeof documentConfig)[keyof typeof documentConfig][]
  purposes: string[]
  sectors: string[]
  idTypes: string[]
  puroks: string[]
  streets: string[]
  associations: string[]
  officials: { id: string; name: string; position: string }[]
  civilStatuses: string[]
}
export type IssuanceCheck = {
  existingIssued?: { referenceNo: string; issueDate: string }
  missingResidentFields: string[]
}
export type CreateIssuanceResult = MockIssuance

export function getResidentAddress(resident: ResidentRecord) {
  if (resident.houseNumber || resident.street || resident.purok)
    return [
      [resident.houseNumber?.trim(), resident.street?.trim()]
        .filter(Boolean)
        .join(" "),
      resident.purok ? `Purok ${resident.purok}` : "",
    ]
      .filter(Boolean)
      .join(", ")
  return resident.address.replace(/,\s*Mayondon.*$/i, "")
}

export function snapshotAddress(resident: ResidentRecord) {
  const address = getResidentAddress(resident)
  return address.includes(",") ? address : address
}

export function missingFields(
  resident: ResidentRecord,
  code: DocumentCode,
): string[] {
  const needs = ["address", ...documentConfig[code].residentNeeds]
  return needs.filter((field) => {
    if (field === "address")
      return (
        !resident.houseNumber?.trim() ||
        !resident.street?.trim() ||
        !resident.purok
      )
    if (field === "birthDate") return !resident.birthdate
    if (field === "birthPlace") return !resident.birthplace
    if (field === "sex") return !resident.sex
    if (field === "civilStatus") return !resident.civilStatus
    if (field === "residentSince")
      return !resident.residentSinceBirth && !resident.residentSince
    if (field === "sector") return !resident.sectors?.length
    if (field === "photo") return !resident.photoUrl
    if (field === "emergencyContact")
      return (
        !resident.emergencyContact?.name ||
        !resident.emergencyContact.address ||
        !resident.emergencyContact.phone
      )
    return false
  })
}

export function getMissingResidentFields(
  resident: ResidentRecord,
  code: DocumentCode,
) {
  return missingFields(resident, code)
}
