/**
 * The New Issuance form talks to this file. It keeps the shapes the form already
 * uses (ResidentRecord, IssuanceInput, MockIssuance) and turns them into calls to
 * the real API, and the answers back again. Names in the form (streets, sectors,
 * ID types, associations, purposes) are matched to database ids here.
 */
import { AxiosError } from "axios"

import {
  type IssuanceCreate,
  type IssuancePublic,
  IssuancesService,
  type IssuanceUpdate,
  type LookupItem,
  LookupsService,
  OfficialsService,
  type ResidentCreate,
  type ResidentPublic,
  ResidentsService,
  type ResidentUpdate,
} from "@/client"
import { client } from "@/client/client.gen"
import { indigencySectorOptions } from "@/components/Issuances/config"
import type { ResidentRecord } from "@/components/Records/records-sample-data"
import { issuanceErrorMessage } from "@/lib/issuanceErrors"
import { readApiError } from "@/lib/residents"
import { type DocumentCode, documentConfig } from "./documentConfig"
import {
  type CreateIssuanceResult,
  getMissingResidentFields,
  getResidentAddress,
  type IssuanceCheck,
  type IssuanceLookups,
  type MockIssuance,
  type QuickResidentInput,
  type ResidentPatch,
  type StoredDocumentDetails,
} from "./issuanceTypes"
import type { IssuanceInput } from "./schemas"

export type { MockIssuance, QuickResidentInput, ResidentPatch }
export { getMissingResidentFields, getResidentAddress }

/** Stands in for the picture while it is being loaded (the real bytes need a separate request). */
export const PHOTO_ON_FILE = "photo-on-file"

type OfficialChoice = { id: string; name: string; position: string }

type LookupData = {
  documentTypes: { id: number; code: string }[]
  sectors: LookupItem[]
  idTypes: LookupItem[]
  purposes: LookupItem[]
  streets: LookupItem[]
  associations: LookupItem[]
  officials: OfficialChoice[]
}

let lookupPromise: Promise<LookupData> | null = null

function loadLookups(): Promise<LookupData> {
  if (!lookupPromise) {
    lookupPromise = (async () => {
      const [
        documentTypes,
        sectors,
        idTypes,
        purposes,
        streets,
        associations,
        officials,
      ] = await Promise.all([
        LookupsService.listDocumentTypes(),
        LookupsService.listSectors(),
        LookupsService.listIdTypes(),
        LookupsService.listIssuancePurposes(),
        LookupsService.listStreets(),
        LookupsService.listTricycleAssociations(),
        OfficialsService.listOfficials({ query: { status: "current" } }),
      ])
      return {
        documentTypes: documentTypes.data.map(({ id, code }) => ({ id, code })),
        sectors: sectors.data,
        idTypes: idTypes.data,
        purposes: purposes.data,
        streets: streets.data,
        associations: associations.data,
        officials: officials.data.map((official) => ({
          id: official.id,
          name: official.full_name,
          position: official.position,
        })),
      }
    })().catch((error) => {
      lookupPromise = null
      throw error
    })
  }
  return lookupPromise
}

/** Forget the cached lists (after a street, association or purpose was added). */
export function refreshLookups() {
  lookupPromise = null
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()
const findByName = (items: LookupItem[], name: string) =>
  items.find((item) => sameName(item.name, name))
const nameOf = (items: LookupItem[], id: number | null | undefined) =>
  items.find((item) => item.id === id)?.name ?? ""
const text = (value: string | undefined | null) => (value ?? "").trim()
const orNull = (value: string | undefined | null) => text(value) || null

function fail(error: unknown, fallback?: string): never {
  const message = issuanceErrorMessage(error)
  const status =
    error instanceof AxiosError ? error.response?.status : undefined
  const detail = readApiError(error).detail as
    | Record<string, unknown>
    | undefined
  throw Object.assign(
    new Error(message || fallback || "Something went wrong."),
    {
      status,
      code: readApiError(error).code,
      detail,
    },
  )
}

// ---------------------------------------------------------------- residents

const photoCache = new Map<string, string>()

function photoKey(resident: ResidentPublic) {
  return `${resident.id}|${resident.updated_at}`
}

function toResidentRecord(
  resident: ResidentPublic,
  data: LookupData,
): ResidentRecord {
  const street = nameOf(data.streets, resident.street_id)
  const record: ResidentRecord = {
    id: resident.id,
    name: resident.full_name,
    firstName: resident.first_name,
    middleName: resident.middle_name ?? "",
    lastName: resident.last_name,
    suffix: resident.suffix ?? "",
    birthdate: resident.birthdate ?? "",
    birthplace: resident.birth_place ?? "",
    sex: resident.sex ?? "",
    civilStatus: resident.civil_status ?? "",
    sectors: resident.sector_ids
      .map((id) => nameOf(data.sectors, id))
      .filter(Boolean),
    residentSince: resident.resident_since_birth
      ? 0
      : (resident.resident_since_year ?? undefined),
    residentSinceBirth: Boolean(resident.resident_since_birth),
    photoUrl: resident.has_photo
      ? (photoCache.get(photoKey(resident)) ?? PHOTO_ON_FILE)
      : undefined,
    address: "",
    houseNumber: resident.house_number ?? "",
    street,
    purok: resident.purok ?? undefined,
    residentType: resident.resident_type ?? "",
    idNumber: resident.id_number ?? "",
    idStatus: "None",
    registration:
      resident.voter_registration === "registered"
        ? "Registered"
        : "Unregistered",
    status: resident.status === "archived" ? "Archived" : "Active",
    archiveReason: resident.archive_reason ?? undefined,
  }
  if (
    resident.emergency_contact_name ||
    resident.emergency_contact_address ||
    resident.emergency_contact_phone
  ) {
    record.emergencyContact = {
      name: resident.emergency_contact_name ?? "",
      address: resident.emergency_contact_address ?? "",
      phone: resident.emergency_contact_phone ?? "",
    }
  }
  record.address = [
    [record.houseNumber, street].filter(Boolean).join(" "),
    record.purok ? `Purok ${record.purok}` : "",
  ]
    .filter(Boolean)
    .join(", ")
  return record
}

const residentCache = new Map<string, ResidentRecord>()

function remember(resident: ResidentPublic, data: LookupData) {
  const record = toResidentRecord(resident, data)
  residentCache.set(record.id, record)
  return record
}

/** Finds the street id for a typed name. An administrator may add a new street; staff may not. */
async function streetIdFor(
  name: string,
  data: LookupData,
): Promise<number | null> {
  const typed = text(name)
  if (!typed) return null
  const found = findByName(data.streets, typed)
  if (found) return found.id
  try {
    const created = await LookupsService.createStreet({ body: { name: typed } })
    refreshLookups()
    data.streets = [...data.streets, created.data]
    return created.data.id
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 403) {
      throw new Error(
        `“${typed}” is not on the street list yet. Ask the administrator to add it, or choose a street from the list.`,
      )
    }
    return fail(error)
  }
}

async function associationIdFor(
  name: string,
  data: LookupData,
): Promise<number> {
  const typed = text(name)
  const found = findByName(data.associations, typed)
  if (found) return found.id
  try {
    const created = await LookupsService.createTricycleAssociation({
      body: { name: typed },
    })
    refreshLookups()
    data.associations = [...data.associations, created.data]
    return created.data.id
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 403) {
      throw new Error(
        `“${typed}” is not on the tricycle association list yet. Ask the administrator to add it, or choose one from the list.`,
      )
    }
    return fail(error)
  }
}

const suffixValues = ["Jr.", "Sr.", "II", "III", "IV", "V"] as const
type Suffix = (typeof suffixValues)[number]
const asSuffix = (value: string | undefined): Suffix | null =>
  suffixValues.find((suffix) => suffix === text(value)) ?? null
const civilValues = [
  "Single",
  "Married",
  "Legally Separated",
  "Widow/Widower",
] as const
const asCivil = (value: string | undefined) =>
  civilValues.find((status) => status === text(value)) ?? null

async function toResidentUpdate(
  patch: ResidentPatch,
  data: LookupData,
): Promise<ResidentUpdate> {
  const update: ResidentUpdate = {}
  if (patch.firstName !== undefined) update.first_name = text(patch.firstName)
  if (patch.middleName !== undefined)
    update.middle_name = orNull(patch.middleName)
  if (patch.lastName !== undefined) update.last_name = text(patch.lastName)
  if (patch.suffix !== undefined) update.suffix = asSuffix(patch.suffix)
  if (patch.birthdate !== undefined) update.birthdate = patch.birthdate || null
  if (patch.birthplace !== undefined)
    update.birth_place = orNull(patch.birthplace)
  if (patch.sex !== undefined) update.sex = patch.sex || null
  if (patch.civilStatus !== undefined)
    update.civil_status = asCivil(patch.civilStatus)
  if (patch.houseNumber !== undefined)
    update.house_number = orNull(patch.houseNumber)
  if (patch.street !== undefined)
    update.street_id = await streetIdFor(patch.street, data)
  if (patch.purok !== undefined) update.purok = patch.purok ?? null
  if (patch.residentSinceBirth === true) {
    update.resident_since_birth = true
    update.resident_since_year = null
  } else if (
    patch.residentSince !== undefined ||
    patch.residentSinceBirth === false
  ) {
    update.resident_since_birth = false
    update.resident_since_year = patch.residentSince
      ? patch.residentSince
      : null
  }
  if (patch.idNumber !== undefined) update.id_number = orNull(patch.idNumber)
  if (patch.emergencyContact !== undefined) {
    update.emergency_contact_name = orNull(patch.emergencyContact.name)
    update.emergency_contact_address = orNull(patch.emergencyContact.address)
    update.emergency_contact_phone = orNull(patch.emergencyContact.phone)
  }
  if (patch.sectors !== undefined) {
    update.sector_ids = patch.sectors
      .map((name) => findByName(data.sectors, name)?.id)
      .filter((id): id is number => id !== undefined)
  }
  return update
}

/** Turns a picture from the camera or a file into PNG bytes under the 300 KB limit. */
async function photoBlob(dataUrl: string): Promise<Blob> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("The photo could not be read."))
    image.src = dataUrl
  })
  let scale = Math.min(1, 600 / Math.max(image.width, image.height))
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("The photo could not be processed.")
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    )
    if (blob && blob.size <= 307200) return blob
    scale *= 0.75
  }
  throw new Error("The photo is too large to save. Please take it again.")
}

async function savePhoto(residentId: string, dataUrl: string) {
  const blob = await photoBlob(dataUrl)
  await client.put({
    url: "/api/v1/residents/{resident_id}/photo",
    path: { resident_id: residentId },
    body: blob,
    headers: { "Content-Type": "image/png" },
    security: [{ scheme: "bearer", type: "http" }],
  })
}

async function fetchPhoto(residentId: string): Promise<string | undefined> {
  try {
    const response = await client.get({
      url: "/api/v1/residents/{resident_id}/photo",
      path: { resident_id: residentId },
      responseType: "blob",
      security: [{ scheme: "bearer", type: "http" }],
    })
    const blob = response.data as Blob
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------- issuances

const detailSections: Record<DocumentCode, string[]> = {
  BARANGAY_CLEARANCE: ["identification", "payment"],
  FRANCHISE_CLEARANCE: ["identification", "payment", "franchise"],
  UTILITY_CLEARANCE: ["identification", "payment", "utility"],
  RESIDENCY: ["identification", "payment"],
  INDIGENCY: ["sectors", "indigency"],
  ASSISTANCE: ["sectors", "assistance"],
  MARGINALIZED_SECTOR: ["sectors", "marginalized"],
  FIRST_TIME_JOBSEEKER: ["jobseeker"],
  BARANGAY_ID: ["barangay_id"],
}

function idTypeName(code: DocumentCode, index: number) {
  const field = documentConfig[code].fields.find(
    (item) => item.name === "idType",
  )
  return index > 0 ? (field?.options ?? [])[index - 1] : undefined
}

/**
 * Sections the form has filled in completely become API sections. A section that is
 * not complete is `null`, which removes it from a draft (the API refuses half-filled sections).
 */
async function buildSections(input: IssuanceInput, data: LookupData) {
  const code = input.documentType
  const sections: Record<string, unknown> = {}
  const allowed = detailSections[code]
  const details = input.details as unknown as Record<string, unknown>

  if (allowed.includes("identification")) {
    const identification = input.identification
    const typeName = identification
      ? idTypeName(code, identification.idTypeId)
      : undefined
    const typeId = typeName ? findByName(data.idTypes, typeName)?.id : undefined
    sections.identification =
      identification && typeId && text(identification.idNumber)
        ? {
            id_type_id: typeId,
            id_number: text(identification.idNumber),
            place_of_issue: text(identification.placeOfIssue) || undefined,
            date_of_issue: identification.dateOfIssue || null,
          }
        : null
  }
  if (allowed.includes("payment")) {
    const payment = input.payment
    sections.payment = !payment
      ? null
      : payment.isFree
        ? {
            is_free: true,
            date_of_payment: payment.dateOfPayment || null,
            certified_by: orNull(payment.certifiedBy),
          }
        : text(payment.officialReceiptNo)
          ? {
              is_free: false,
              official_receipt_no: text(payment.officialReceiptNo),
              date_of_payment: payment.dateOfPayment || null,
              certified_by: orNull(payment.certifiedBy),
            }
          : null
  }
  if (allowed.includes("sectors")) {
    const chosen = (input.sectors ?? [])
      .map((sector) => {
        const name = indigencySectorOptions[sector.sectorId - 1]
        const id = name ? findByName(data.sectors, name)?.id : undefined
        return id
          ? { sector_id: id, sector_id_number: orNull(sector.idNumber) }
          : null
      })
      .filter((sector) => sector !== null)
    sections.sectors = chosen.length ? chosen : null
  }
  switch (code) {
    case "UTILITY_CLEARANCE": {
      const services = (details.services as string[] | undefined) ?? []
      sections.utility =
        services.length && text(details.location as string)
          ? {
              has_electric: services.includes("electric"),
              has_water: services.includes("water"),
              connection_type: details.connectionType,
              classification: details.classification,
              location: text(details.location as string),
            }
          : null
      break
    }
    case "INDIGENCY":
      sections.indigency = text(details.addressedToOffice as string)
        ? {
            addressed_to_office: text(details.addressedToOffice as string),
            requested_by: orNull(details.requestedBy as string),
          }
        : null
      break
    case "ASSISTANCE": {
      const forSelf = details.forSelf !== false
      sections.assistance =
        forSelf ||
        (text(details.beneficiaryName as string) &&
          text(details.beneficiaryRelationship as string))
          ? {
              assistance_type: details.assistanceType,
              for_self: forSelf,
              beneficiary_name: forSelf
                ? null
                : orNull(details.beneficiaryName as string),
              beneficiary_relationship: forSelf
                ? null
                : orNull(details.beneficiaryRelationship as string),
            }
          : null
      break
    }
    case "MARGINALIZED_SECTOR": {
      const condition = text(details.healthCondition as string)
      sections.marginalized =
        condition && condition !== "[restricted]"
          ? { health_condition: condition }
          : null
      break
    }
    case "FIRST_TIME_JOBSEEKER":
      sections.jobseeker = text(details.educationalAttainment as string)
        ? {
            educational_attainment: text(
              details.educationalAttainment as string,
            ),
            course: text(details.course as string) || "N/A",
            is_jobstart_beneficiary: Boolean(details.isJobstartBeneficiary),
            witness_official_id: orNull(details.witnessOfficialId as string),
          }
        : null
      break
    case "FRANCHISE_CLEARANCE": {
      const complete = [
        "associationName",
        "make",
        "bodyType",
        "motorNumber",
        "color",
        "plateNumber",
      ].every((key) => text(details[key] as string))
      sections.franchise = complete
        ? {
            association_id: await associationIdFor(
              details.associationName as string,
              data,
            ),
            make: text(details.make as string),
            body_type: text(details.bodyType as string),
            motor_number: text(details.motorNumber as string),
            color: text(details.color as string),
            plate_number: text(details.plateNumber as string),
          }
        : null
      break
    }
    case "BARANGAY_ID":
      sections.barangay_id = details.validUntil
        ? {
            transaction_type: details.transactionType,
            valid_until: details.validUntil,
            id_number: orNull(details.idNumber as string),
          }
        : null
      break
    default:
      break
  }
  return sections
}

function purposeIdFor(input: IssuanceInput, data: LookupData) {
  if (input.purposeId) return input.purposeId
  const typed = text(input.purposeText)
  return typed ? findByName(data.purposes, typed)?.id : undefined
}

const toApiOfficial = (id: string | undefined) => text(id) || null

async function toCreateBody(
  input: IssuanceInput,
  data: LookupData,
): Promise<IssuanceCreate> {
  const documentType = data.documentTypes.find(
    (type) => type.code === input.documentType,
  )
  if (!documentType) throw new Error("This document type is not available.")
  const sections = await buildSections(input, data)
  const present = Object.fromEntries(
    Object.entries(sections).filter(([, value]) => value !== null),
  )
  return {
    document_type_id: documentType.id,
    resident_id: input.residentId,
    issue_date: input.issueDate || null,
    purpose_id: purposeIdFor(input, data) ?? null,
    remarks: orNull(input.remarks),
    signatory_official_id: toApiOfficial(input.signatoryOfficialId),
    ...present,
  } as IssuanceCreate
}

async function toUpdateBody(
  input: IssuanceInput,
  data: LookupData,
): Promise<IssuanceUpdate> {
  const sections = await buildSections(input, data)
  return {
    issue_date: input.issueDate || null,
    purpose_id: purposeIdFor(input, data) ?? null,
    remarks: orNull(input.remarks),
    signatory_official_id: toApiOfficial(input.signatoryOfficialId),
    ...sections,
  } as IssuanceUpdate
}

function toMockIssuance(issuance: IssuancePublic): MockIssuance {
  const code = issuance.document_type_code as DocumentCode
  const franchise = issuance.franchise
  const utility = issuance.utility
  const idCard = issuance.barangay_id
  const jobseeker = issuance.jobseeker
  const assistance = issuance.assistance
  let details: StoredDocumentDetails
  switch (code) {
    case "FRANCHISE_CLEARANCE":
      details = {
        type: code,
        tricycleId: franchise ? String(franchise.tricycle_id) : undefined,
      }
      break
    case "UTILITY_CLEARANCE":
      details = {
        type: code,
        services: [
          ...(utility?.has_electric ? (["electric"] as const) : []),
          ...(utility?.has_water ? (["water"] as const) : []),
        ],
        connectionType: (utility?.connection_type ?? "new") as
          | "new"
          | "reconnection",
        classification: (utility?.classification ?? "residential") as
          | "residential"
          | "commercial",
        location: utility?.location ?? "",
      }
      break
    case "INDIGENCY":
      details = {
        type: code,
        addressedToOffice: issuance.indigency?.addressed_to_office ?? "",
        requestedBy: issuance.indigency?.requested_by ?? undefined,
      }
      break
    case "ASSISTANCE":
      details = {
        type: code,
        assistanceType: (assistance?.assistance_type ?? "financial") as
          | "financial"
          | "medical"
          | "burial",
        forSelf: assistance?.for_self ?? true,
        beneficiaryName: assistance?.beneficiary_name ?? undefined,
        beneficiaryRelationship:
          assistance?.beneficiary_relationship ?? undefined,
      }
      break
    case "MARGINALIZED_SECTOR":
      // The API answers "[restricted]" except when a single record is opened; never treat it as data.
      details = {
        type: code,
        healthCondition: issuance.marginalized?.health_condition ?? "",
      }
      break
    case "FIRST_TIME_JOBSEEKER":
      details = {
        type: code,
        educationalAttainment: jobseeker?.educational_attainment ?? "",
        course: jobseeker?.course ?? "",
        isJobstartBeneficiary: jobseeker?.is_jobstart_beneficiary ?? false,
        witnessOfficialId: jobseeker?.witness_official_id ?? "",
      }
      break
    case "BARANGAY_ID":
      details = {
        type: code,
        transactionType: (idCard?.transaction_type ?? "new") as
          | "new"
          | "renewal"
          | "replacement",
        validUntil: idCard?.valid_until ?? "",
        idNumber: idCard?.id_number ?? undefined,
      }
      break
    default:
      details = { type: code }
  }
  const snapshot = issuance.snapshot
  return {
    id: issuance.id,
    referenceNo: issuance.reference_no ?? "Draft",
    documentType: code,
    residentId: issuance.resident_id,
    issueDate: issuance.issue_date,
    status: issuance.status as MockIssuance["status"],
    correctsIssuanceId: issuance.corrects_issuance_id ?? undefined,
    correctionReason: issuance.correction_reason ?? undefined,
    voidReason: issuance.void_reason ?? undefined,
    issuedAt: issuance.issued_at ?? undefined,
    payload: {
      documentType: code,
      issueDate: issuance.issue_date,
      residentId: issuance.resident_id,
      purposeId: issuance.purpose_id ?? undefined,
      remarks: issuance.remarks ?? undefined,
      signatoryOfficialId: issuance.signatory_official_id ?? undefined,
      identification: issuance.identification
        ? {
            idTypeId: issuance.identification.id_type_id,
            idNumber: issuance.identification.id_number,
            placeOfIssue: issuance.identification.place_of_issue,
            dateOfIssue: issuance.identification.date_of_issue,
          }
        : undefined,
      payment: issuance.payment
        ? {
            officialReceiptNo: issuance.payment.official_receipt_no,
            isFree: issuance.payment.is_free,
            dateOfPayment: issuance.payment.date_of_payment,
            certifiedBy: issuance.payment.certified_by ?? undefined,
          }
        : undefined,
      sectors: (issuance.sectors ?? []).map((sector) => ({
        sectorId: sector.sector_id,
        idNumber: sector.sector_id_number ?? undefined,
      })),
      details,
      status: issuance.status === "draft" ? "draft" : "issued",
    },
    residentSnapshot: snapshot
      ? {
          fullName: snapshot.full_name,
          addressLine: snapshot.address_line ?? "",
          birthDate: snapshot.birth_date ?? undefined,
          birthPlace: snapshot.birth_place ?? undefined,
          sex: snapshot.sex ?? undefined,
          civilStatus: snapshot.civil_status ?? undefined,
          residentSinceYear: snapshot.resident_since_year ?? undefined,
          residentSinceBirth: snapshot.resident_since_birth,
        }
      : undefined,
  }
}

export const issuanceApi = {
  /** Residents already loaded in this session (search, create, update). */
  getResident(id: string): ResidentRecord | undefined {
    return residentCache.get(id)
  },

  /** Loads one resident from the server, including whether a photo is on file. */
  async fetchResident(id: string): Promise<ResidentRecord | undefined> {
    try {
      const [data, response] = await Promise.all([
        loadLookups(),
        ResidentsService.readResident({ path: { resident_id: id } }),
      ])
      return remember(response.data, data)
    } catch {
      return undefined
    }
  },

  /** The photo bytes as a data URL, or undefined when there is none. */
  async loadResidentPhoto(id: string): Promise<string | undefined> {
    const resident = await this.fetchResident(id)
    if (!resident || resident.photoUrl === undefined) return undefined
    if (resident.photoUrl !== PHOTO_ON_FILE) return resident.photoUrl
    const url = await fetchPhoto(id)
    if (url) {
      const fresh = await ResidentsService.readResident({
        path: { resident_id: id },
      })
      photoCache.set(photoKey(fresh.data), url)
    }
    return url
  },

  async getResidentName(id: string) {
    const resident = residentCache.get(id) ?? (await this.fetchResident(id))
    return resident
      ? {
          firstName: resident.firstName,
          middleName: resident.middleName,
          lastName: resident.lastName,
          suffix: resident.suffix,
        }
      : undefined
  },

  getPurposeLabel(id?: number) {
    return id ? purposeLabels.get(id) : undefined
  },

  async searchResidents(query = ""): Promise<ResidentRecord[]> {
    try {
      const [data, response] = await Promise.all([
        loadLookups(),
        ResidentsService.listResidents({
          query: { q: query.trim() || undefined, status: "active", limit: 8 },
        }),
      ])
      return response.data.data.map((resident) => remember(resident, data))
    } catch (error) {
      return fail(error)
    }
  },

  async createResident(input: QuickResidentInput): Promise<ResidentRecord> {
    try {
      const data = await loadLookups()
      const body: ResidentCreate = {
        first_name: text(input.firstName),
        middle_name: orNull(input.middleName),
        last_name: text(input.lastName),
        suffix: asSuffix(input.suffix),
        birthdate: input.birthdate || null,
        birth_place: orNull(input.birthplace),
        sex: input.sex || null,
        civil_status: asCivil(input.civilStatus),
        house_number: orNull(input.houseNumber),
        street_id: await streetIdFor(input.street, data),
        purok: input.purok,
        resident_since_birth: input.residentSinceBirth,
        resident_since_year: input.residentSinceBirth
          ? null
          : (input.residentSinceYear ?? null),
      }
      const response = await ResidentsService.createResident({ body })
      if (input.photoUrl?.startsWith("data:"))
        await savePhoto(response.data.id, input.photoUrl)
      return (
        (await this.fetchResident(response.data.id)) ??
        remember(response.data, data)
      )
    } catch (error) {
      return fail(error)
    }
  },

  async updateResident(
    id: string,
    patch: ResidentPatch,
  ): Promise<ResidentRecord> {
    try {
      const data = await loadLookups()
      const body = await toResidentUpdate(patch, data)
      if (Object.keys(body).length) {
        await ResidentsService.updateResident({
          path: { resident_id: id },
          body,
        })
      }
      if (patch.photoUrl?.startsWith("data:"))
        await savePhoto(id, patch.photoUrl)
      const fresh = await this.fetchResident(id)
      if (!fresh) throw new Error("Resident record was not found.")
      if (patch.photoUrl?.startsWith("data:")) fresh.photoUrl = patch.photoUrl
      return fresh
    } catch (error) {
      return fail(error)
    }
  },

  async getLookups(): Promise<IssuanceLookups> {
    const data = await loadLookups()
    const byId = (items: LookupItem[]) =>
      [...items].sort((a, b) => a.id - b.id).map((item) => item.name)
    purposeLabels.clear()
    for (const purpose of data.purposes)
      purposeLabels.set(purpose.id, purpose.name)
    return {
      documentTypes: Object.values(documentConfig),
      // Ordered by id: the print code reads these lists by id.
      purposes: byId(data.purposes),
      sectors: byId(data.sectors),
      idTypes: byId(data.idTypes),
      puroks: [
        "Purok 1",
        "Purok 2",
        "Purok 3",
        "Purok 4",
        "Purok 5",
        "Purok 6",
      ],
      streets: data.streets.map((street) => street.name),
      associations: data.associations.map((association) => association.name),
      officials: data.officials,
      civilStatuses: [...civilValues],
    }
  },

  async getOfficials(): Promise<OfficialChoice[]> {
    return (await loadLookups()).officials
  },

  /** What the form needs before issuing: is a one-per-resident document already out, what is missing. */
  async checkIssuance(
    residentId: string,
    documentType: DocumentCode,
  ): Promise<IssuanceCheck> {
    try {
      const data = await loadLookups()
      const resident =
        (await this.fetchResident(residentId)) ?? residentCache.get(residentId)
      if (!resident) throw new Error("Select a resident record first.")
      let existingIssued: IssuanceCheck["existingIssued"]
      const type = data.documentTypes.find((item) => item.code === documentType)
      if (documentConfig[documentType].onePerResident && type) {
        const response = await IssuancesService.listIssuances({
          query: {
            resident_id: residentId,
            document_type_id: type.id,
            status: "issued",
            limit: 1,
          },
        })
        const found = response.data.data[0]
        if (found) {
          existingIssued = {
            referenceNo: found.reference_no ?? "",
            issueDate: found.issue_date,
          }
        }
      }
      return {
        existingIssued,
        missingResidentFields: getMissingResidentFields(resident, documentType),
      }
    } catch (error) {
      return fail(error)
    }
  },

  /** A franchise is read from the issuance itself; the tricycle id is the API's number. */
  async getTricycle(id?: string) {
    const issuanceId = id ? tricycleIssuance.get(id) : undefined
    if (!issuanceId) return undefined
    const data = await loadLookups()
    const response = await IssuancesService.getIssuance({
      path: { issuance_id: issuanceId },
    })
    const franchise = response.data.franchise
    return franchise
      ? {
          id: String(franchise.tricycle_id),
          associationId: franchise.association_id,
          make: franchise.make,
          bodyType: franchise.body_type,
          motorNumber: franchise.motor_number,
          color: franchise.color,
          plateNumber: franchise.plate_number,
          associationName: nameOf(data.associations, franchise.association_id),
        }
      : undefined
  },

  /** Saves a draft, or saves and issues when the input says `issued`. */
  async createIssuance(input: IssuanceInput): Promise<CreateIssuanceResult> {
    let draftId: string | undefined
    try {
      const data = await loadLookups()
      await applyResidentUpdates(input)
      const created = await IssuancesService.createIssuance({
        body: await toCreateBody(input, data),
      })
      draftId = created.data.id
      if (input.status === "draft") return await finish(created.data)
      const purposeName = text(input.purposeText)
      const needsName =
        !input.purposeId && purposeName && !purposeIdFor(input, data)
      const issued = await IssuancesService.issue({
        path: { issuance_id: draftId },
        body: needsName ? { purpose_name: purposeName } : undefined,
      })
      if (needsName) refreshLookups()
      draftId = undefined
      return await finish(issued.data)
    } catch (error) {
      // A half-made issuance must not be left behind when issuing fails.
      if (draftId && input.status !== "draft") {
        await IssuancesService.discardDraft({
          path: { issuance_id: draftId },
        }).catch(() => undefined)
      }
      return fail(error)
    }
  },

  async getIssuance(id: string) {
    try {
      const response = await IssuancesService.getIssuance({
        path: { issuance_id: id },
      })
      return await finish(response.data)
    } catch {
      return undefined
    }
  },

  async correctIssuance(id: string, reason: string) {
    try {
      const response = await IssuancesService.correct({
        path: { issuance_id: id },
        body: { reason: reason.trim() },
      })
      return await finish(response.data)
    } catch (error) {
      return fail(error)
    }
  },

  async voidIssuance(id: string, reason: string) {
    try {
      const response = await IssuancesService.void({
        path: { issuance_id: id },
        body: { reason: reason.trim() },
      })
      return await finish(response.data)
    } catch (error) {
      return fail(error)
    }
  },

  async deleteDraft(id: string) {
    try {
      await IssuancesService.discardDraft({ path: { issuance_id: id } })
      return true
    } catch {
      return false
    }
  },

  async updateDraft(id: string, input: IssuanceInput) {
    try {
      const data = await loadLookups()
      await applyResidentUpdates(input)
      const response = await IssuancesService.updateDraft({
        path: { issuance_id: id },
        body: await toUpdateBody(input, data),
      })
      return await finish(response.data)
    } catch (error) {
      return fail(error)
    }
  },
}

const purposeLabels = new Map<number, string>()
const tricycleIssuance = new Map<string, string>()

async function applyResidentUpdates(input: IssuanceInput) {
  const updates = input.residentUpdates as ResidentPatch | undefined
  if (updates && Object.keys(updates).length) {
    await issuanceApi.updateResident(input.residentId, updates)
  }
}

async function finish(issuance: IssuancePublic): Promise<MockIssuance> {
  const data = await loadLookups()
  for (const purpose of data.purposes)
    purposeLabels.set(purpose.id, purpose.name)
  if (issuance.franchise) {
    tricycleIssuance.set(String(issuance.franchise.tricycle_id), issuance.id)
  }
  return toMockIssuance(issuance)
}
