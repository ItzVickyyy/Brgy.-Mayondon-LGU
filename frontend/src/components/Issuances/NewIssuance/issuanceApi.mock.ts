import { clearancePurposeOptions } from "@/components/Issuances/config"
import type { ResidentRecord } from "@/components/Records/records-sample-data"
import { type DocumentCode, documentConfig } from "./documentConfig"
import {
  type CreateIssuanceResult,
  type IssuanceCheck,
  type IssuanceLookups,
  type MockIssuance,
  missingFields,
  type QuickResidentInput,
  type ResidentPatch,
  type StoredDocumentDetails,
  type StoredIssuancePayload,
  snapshotAddress,
} from "./issuanceTypes"
import { type IssuanceInput, issuanceInputSchema } from "./schemas"

export type {
  MockIssuance,
  QuickResidentInput,
  ResidentPatch,
} from "./issuanceTypes"
export { getMissingResidentFields, getResidentAddress } from "./issuanceTypes"

let residents: ResidentRecord[] = []
let issuances: MockIssuance[] = []
let issuanceCounter = 0
let streets = ["Rizal Street", "Mabini Street", "Bonifacio Street"]
let purposes = [...clearancePurposeOptions]
let associations = ["Mayondon Tricycle Operators and Drivers Association"]
let mockTricycles: {
  id: string
  associationId: number
  make: string
  bodyType: string
  motorNumber: string
  color: string
  plateNumber: string
}[] = []

function toStoredPayload(
  input: IssuanceInput,
  tricycleId?: string,
): StoredIssuancePayload {
  const {
    residentUpdates: _residentUpdates,
    purposeText,
    details,
    ...base
  } = input
  const purposeId =
    input.purposeId ??
    (purposeText?.trim()
      ? purposes.findIndex(
          (purpose) =>
            purpose.toLowerCase() === purposeText.trim().toLowerCase(),
        ) + 1
      : undefined)
  let storedDetails: StoredDocumentDetails
  if (details.type === "FRANCHISE_CLEARANCE") {
    storedDetails = { type: "FRANCHISE_CLEARANCE", tricycleId }
  } else if (details.type === "FIRST_TIME_JOBSEEKER") {
    const { parts: _parts, ...jobseekerDetails } = details
    storedDetails = jobseekerDetails
  } else {
    storedDetails = details
  }
  return {
    ...base,
    purposeId: purposeId && purposeId > 0 ? purposeId : undefined,
    details: storedDetails,
  }
}

export const issuanceApi = {
  getNextBarangayIdNumber() {
    const max = residents.reduce((highest, resident) => {
      const suffix = Number(resident.idNumber.split("-").slice(-1)[0] ?? 0)
      return Number.isFinite(suffix) ? Math.max(highest, suffix) : highest
    }, 0)
    return String(max + 1).padStart(4, "0")
  },

  getResident(id: string) {
    return residents.find((resident) => resident.id === id)
  },

  async getResidentName(id: string) {
    const resident = residents.find((item) => item.id === id)
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
    return id ? purposes[id - 1] : undefined
  },

  async searchResidents(query = ""): Promise<ResidentRecord[]> {
    const q = query.trim().toLowerCase()
    return residents
      .filter((resident) => resident.status === "Active")
      .filter(
        (resident) =>
          !q ||
          [
            resident.name,
            resident.id,
            resident.idNumber,
            resident.address,
          ].some((value) => value.toLowerCase().includes(q)),
      )
  },

  async createResident(input: QuickResidentInput): Promise<ResidentRecord> {
    const sequence =
      residents.reduce(
        (max, resident) =>
          Math.max(max, Number(resident.id.match(/\d+$/)?.[0] ?? 0)),
        0,
      ) + 1
    const name = [
      input.firstName.trim(),
      input.middleName?.trim(),
      input.lastName.trim(),
      input.suffix?.trim(),
    ]
      .filter(Boolean)
      .join(" ")
    const address = [
      [input.houseNumber?.trim(), input.street.trim()]
        .filter(Boolean)
        .join(" "),
      `Purok ${input.purok}`,
      "Mayondon",
    ]
      .filter(Boolean)
      .join(", ")
    const resident: ResidentRecord = {
      id: `RES-${String(sequence).padStart(4, "0")}`,
      name,
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim() ?? "",
      lastName: input.lastName.trim(),
      suffix: input.suffix?.trim() ?? "",
      birthdate: input.birthdate,
      birthplace: input.birthplace?.trim() ?? "",
      sex: input.sex,
      civilStatus: input.civilStatus,
      sectors: [],
      residentSince: input.residentSinceBirth ? 0 : input.residentSinceYear,
      residentSinceBirth: input.residentSinceBirth,
      photoUrl: input.photoUrl,
      address,
      houseNumber: input.houseNumber?.trim() ?? "",
      street: input.street.trim(),
      purok: input.purok,
      residentType: "Existing resident",
      idNumber: "",
      idStatus: "None",
      registration: "Unregistered",
      status: "Active",
    }
    residents = [...residents, resident]
    if (
      input.street.trim() &&
      !streets.some(
        (street) => street.toLowerCase() === input.street.trim().toLowerCase(),
      )
    )
      streets = [...streets, input.street.trim()]
    return resident
  },

  async updateResident(
    id: string,
    patch: ResidentPatch,
  ): Promise<ResidentRecord> {
    const current = residents.find((resident) => resident.id === id)
    if (!current) throw new Error("Resident record was not found.")
    const updated = { ...current, ...patch }
    residents = residents.map((resident) =>
      resident.id === id ? updated : resident,
    )
    return updated
  },

  async getLookups(): Promise<IssuanceLookups> {
    const { indigencySectorOptions, idTypeOptions, civilStatusOptions } =
      await import("@/components/Issuances/config")
    const { initialOfficials } = await import(
      "@/components/Officials/officials-sample-data"
    )
    return {
      documentTypes: Object.values(documentConfig),
      purposes: [...purposes],
      sectors: [...indigencySectorOptions],
      idTypes: [...new Set(["CTC", ...idTypeOptions])],
      puroks: [
        "Purok 1",
        "Purok 2",
        "Purok 3",
        "Purok 4",
        "Purok 5",
        "Purok 6",
      ],
      streets: [...streets],
      associations: [...associations],
      officials: initialOfficials
        .filter((official) => official.status === "Current")
        .map(({ id, name, position }) => ({ id, name, position })),
      civilStatuses: [...civilStatusOptions],
    }
  },

  async checkIssuance(
    residentId: string,
    documentType: DocumentCode,
  ): Promise<IssuanceCheck> {
    const resident = residents.find((item) => item.id === residentId)
    if (!resident) throw new Error("Select a resident record first.")
    const existing = documentConfig[documentType].onePerResident
      ? issuances.find(
          (item) =>
            item.residentId === residentId &&
            item.documentType === documentType &&
            item.status === "issued",
        )
      : undefined
    return {
      existingIssued: existing
        ? { referenceNo: existing.referenceNo, issueDate: existing.issueDate }
        : undefined,
      missingResidentFields: missingFields(resident, documentType),
    }
  },

  async getTricycles(plate = "", motor = "") {
    const normalizedPlate = plate.trim().toLowerCase()
    const normalizedMotor = motor.trim().toLowerCase()
    const match = mockTricycles.find(
      (tricycle) =>
        (normalizedPlate &&
          tricycle.plateNumber.toLowerCase() === normalizedPlate) ||
        (normalizedMotor &&
          tricycle.motorNumber.toLowerCase() === normalizedMotor),
    )
    return {
      plate,
      motor,
      match: match
        ? {
            ...match,
            associationName: associations[match.associationId - 1] ?? "",
          }
        : undefined,
    }
  },

  /** Looks up a tricycle by the id stored on a franchise issuance (needed to print it). */
  async getTricycle(id?: string) {
    const match = id
      ? mockTricycles.find((tricycle) => tricycle.id === id)
      : undefined
    return match
      ? {
          ...match,
          associationName: associations[match.associationId - 1] ?? "",
        }
      : undefined
  },

  async createIssuance(input: IssuanceInput): Promise<CreateIssuanceResult> {
    const parsed =
      input.status === "draft" ? input : issuanceInputSchema.parse(input)
    // Only a finished issuance adds to the suggestion lists. Half-typed draft text must not.
    if (
      parsed.status === "issued" &&
      parsed.purposeText?.trim() &&
      !purposes.some(
        (purpose) =>
          purpose.toLowerCase() === parsed.purposeText?.trim().toLowerCase(),
      )
    )
      purposes = [...purposes, parsed.purposeText.trim()]
    const franchiseDetails =
      parsed.details.type === "FRANCHISE_CLEARANCE" ? parsed.details : undefined
    if (
      parsed.status === "issued" &&
      franchiseDetails?.associationName.trim() &&
      !associations.some(
        (association) =>
          association.toLowerCase() ===
          franchiseDetails.associationName.trim().toLowerCase(),
      )
    )
      associations = [...associations, franchiseDetails.associationName.trim()]
    const resident = residents.find((item) => item.id === parsed.residentId)
    if (!resident) throw new Error("Select a resident record first.")
    const projectedResident = {
      ...resident,
      ...(parsed.residentUpdates as ResidentPatch | undefined),
    }
    if (parsed.status === "issued") {
      const check = await this.checkIssuance(
        parsed.residentId,
        parsed.documentType,
      )
      if (check.existingIssued) {
        throw Object.assign(
          new Error(
            `An issued ${documentConfig[parsed.documentType].shortName} already exists: ${check.existingIssued.referenceNo} (${check.existingIssued.issueDate}).`,
          ),
          { status: 409, existing: check.existingIssued },
        )
      }
      const missing = missingFields(projectedResident, parsed.documentType)
      if (missing.length)
        throw new Error(
          `Complete the resident record fields needed for this document: ${missing.join(", ")}.`,
        )
    }
    if (parsed.residentUpdates) {
      await this.updateResident(
        resident.id,
        parsed.residentUpdates as ResidentPatch,
      )
    }
    let updatedResident =
      residents.find((item) => item.id === parsed.residentId) ?? resident
    if (
      parsed.status === "issued" &&
      parsed.documentType === "BARANGAY_ID" &&
      !updatedResident.idNumber
    ) {
      updatedResident = await this.updateResident(updatedResident.id, {
        idNumber: `18-128-3597-${this.getNextBarangayIdNumber()}`,
      })
    }
    let tricycleId: string | undefined
    if (franchiseDetails) {
      let tricycle = mockTricycles.find(
        (item) =>
          item.plateNumber.toLowerCase() ===
            franchiseDetails.plateNumber.trim().toLowerCase() ||
          item.motorNumber.toLowerCase() ===
            franchiseDetails.motorNumber.trim().toLowerCase(),
      )
      if (!tricycle && parsed.status === "issued") {
        const associationIndex = associations.findIndex(
          (association) =>
            association.toLowerCase() ===
            franchiseDetails.associationName.trim().toLowerCase(),
        )
        tricycle = {
          id: `TRI-${String(mockTricycles.length + 1).padStart(4, "0")}`,
          associationId: associationIndex + 1,
          make: franchiseDetails.make,
          bodyType: franchiseDetails.bodyType,
          motorNumber: franchiseDetails.motorNumber,
          color: franchiseDetails.color,
          plateNumber: franchiseDetails.plateNumber,
        }
        mockTricycles = [...mockTricycles, tricycle]
      }
      tricycleId = tricycle?.id
    }
    issuanceCounter += 1
    const sequence = issuanceCounter
    const record: MockIssuance = {
      id: `mock-issuance-${sequence}`,
      referenceNo: `ISS-${new Date().getFullYear()}-${String(sequence).padStart(6, "0")}`,
      documentType: parsed.documentType,
      residentId: parsed.residentId,
      issueDate: parsed.issueDate,
      status: parsed.status,
      payload: toStoredPayload(parsed, tricycleId),
      ...(parsed.status === "issued"
        ? {
            residentSnapshot: {
              fullName: [
                updatedResident.firstName,
                updatedResident.middleName,
                updatedResident.lastName,
              ]
                .filter(Boolean)
                .join(" "),
              addressLine: snapshotAddress(updatedResident),
              birthDate: updatedResident.birthdate || undefined,
              birthPlace: updatedResident.birthplace || undefined,
              sex: updatedResident.sex,
              civilStatus: updatedResident.civilStatus,
              photoUrl: updatedResident.photoUrl || undefined,
              residentSinceYear: updatedResident.residentSinceBirth
                ? undefined
                : updatedResident.residentSince || undefined,
              residentSinceBirth: Boolean(updatedResident.residentSinceBirth),
            },
            issuedAt: new Date().toISOString(),
          }
        : {}),
    }
    issuances = [record, ...issuances]
    return record
  },

  async listIssuances() {
    return issuances.map(({ payload, ...record }) => ({
      ...record,
      payload: {
        ...payload,
        details:
          payload.details.type === "MARGINALIZED_SECTOR"
            ? {
                type: "MARGINALIZED_SECTOR" as const,
                healthCondition: "[restricted]",
              }
            : payload.details,
      },
    }))
  },

  async getIssuance(id: string) {
    return issuances.find((item) => item.id === id)
  },

  async correctIssuance(id: string, reason: string, input: IssuanceInput) {
    const original = issuances.find((item) => item.id === id)
    if (original?.status !== "issued")
      throw new Error("Only an issued record can be corrected.")
    if (!reason.trim()) throw new Error("A correction reason is required.")
    const corrected = await this.createIssuance({ ...input, status: "issued" })
    const updated = {
      ...corrected,
      correctsIssuanceId: original.id,
      correctionReason: reason.trim(),
    }
    issuances = issuances.map((item) =>
      item.id === corrected.id ? updated : item,
    )
    return updated
  },

  async voidIssuance(id: string, reason: string, role: "staff" | "admin") {
    if (role !== "admin")
      throw Object.assign(
        new Error("Only the System Administrator can void an issuance."),
        { status: 403 },
      )
    if (!reason.trim()) throw new Error("A void reason is required.")
    const record = issuances.find((item) => item.id === id)
    if (record?.status !== "issued")
      throw new Error("Only an issued record can be voided.")
    const updated = {
      ...record,
      status: "voided" as const,
      voidReason: reason.trim(),
    }
    issuances = issuances.map((item) => (item.id === id ? updated : item))
    return updated
  },

  async deleteDraft(id: string) {
    const existing = issuances.find((item) => item.id === id)
    if (existing?.status !== "draft") return false
    issuances = issuances.filter((item) => item.id !== id)
    return true
  },

  async updateDraft(id: string, input: IssuanceInput) {
    const existing = issuances.find((item) => item.id === id)
    if (existing?.status !== "draft")
      throw new Error("Only drafts can be edited.")
    const parsed = { ...input, status: "draft" as const }
    const updated = {
      ...existing,
      payload: toStoredPayload(parsed),
      issueDate: parsed.issueDate,
      documentType: parsed.documentType,
      residentId: parsed.residentId,
    }
    issuances = issuances.map((item) => (item.id === id ? updated : item))
    return updated
  },
}

export const mockIssuanceStore = {
  reset() {
    residents = []
    issuances = []
    issuanceCounter = 0
    streets = ["Rizal Street", "Mabini Street", "Bonifacio Street"]
    purposes = [...clearancePurposeOptions]
    associations = ["Mayondon Tricycle Operators and Drivers Association"]
    mockTricycles = []
  },
  addStreet(name: string) {
    const normalized = name.trim()
    if (
      normalized &&
      !streets.some(
        (street) => street.toLowerCase() === normalized.toLowerCase(),
      )
    )
      streets = [...streets, normalized]
    return [...streets]
  },
  addAssociation(name: string) {
    const normalized = name.trim()
    if (
      normalized &&
      !associations.some(
        (association) => association.toLowerCase() === normalized.toLowerCase(),
      )
    )
      associations = [...associations, normalized]
    return [...associations]
  },
}
