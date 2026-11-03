import { sampleResidents, type ResidentRecord } from "@/components/Records/records-sample-data"
import { documentConfig, type DocumentCode } from "./documentConfig"
import { issuanceInputSchema, type IssuanceInput } from "./schemas"

export type ResidentPatch = Partial<Pick<ResidentRecord,
  | "birthdate" | "birthplace" | "sex" | "civilStatus" | "sectors" | "residentSince"
  | "address" | "houseNumber" | "street" | "purok" | "photoUrl" | "emergencyContact"
>>
export type QuickResidentInput = {
  lastName: string
  firstName: string
  middleName?: string
  birthdate: string
  sex: "Male" | "Female"
  civilStatus: string
  houseNumber?: string
  street: string
  purok: number
  residentSinceYear?: number
  residentSinceBirth: boolean
}
export type IssuanceStatus = "draft" | "issued" | "voided"
export type MockIssuance = {
  id: string
  referenceNo: string
  documentType: DocumentCode
  residentId: string
  residentName: string
  issueDate: string
  status: IssuanceStatus
  payload: IssuanceInput
  residentSnapshot?: {
    fullName: string
    addressLine: string
    birthDate?: string
    birthPlace?: string
    sex?: string
    civilStatus?: string
    residentSinceYear?: number
    residentSinceBirth: boolean
  }
  issuedAt?: string
}
export type IssuanceLookups = {
  documentTypes: typeof documentConfig[keyof typeof documentConfig][]
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

let residents = [...sampleResidents]
let issuances: MockIssuance[] = []
let streets = ["Rizal Street", "Mabini Street", "Bonifacio Street"]
let associations = ["Mayondon Tricycle Operators and Drivers Association"]

export function getResidentAddress(resident: ResidentRecord) {
  if (resident.houseNumber || resident.street || resident.purok) return [resident.houseNumber?.trim(), resident.street?.trim(), resident.purok ? `Purok ${resident.purok}` : ""].filter(Boolean).join(", ")
  return resident.address.replace(/,\s*Mayondon.*$/i, "")
}

function snapshotAddress(resident: ResidentRecord) {
  const address = getResidentAddress(resident)
  return address.includes(",") ? address : address
}

function missingFields(resident: ResidentRecord, code: DocumentCode): string[] {
  const needs = ["address", ...documentConfig[code].residentNeeds]
  return needs.filter((field) => {
    if (field === "address") return !resident.houseNumber?.trim() || !resident.street?.trim() || !resident.purok
    if (field === "birthDate") return !resident.birthdate
    if (field === "birthPlace") return !resident.birthplace
    if (field === "sex") return !resident.sex
    if (field === "civilStatus") return !resident.civilStatus
    if (field === "residentSince") return resident.residentSince === undefined
    if (field === "sector") return !resident.sectors?.length
    if (field === "photo") return !resident.photoUrl
    if (field === "emergencyContact") return !resident.emergencyContact?.name || !resident.emergencyContact.address || !resident.emergencyContact.phone
    return false
  })
}

export function getMissingResidentFields(resident: ResidentRecord, code: DocumentCode) {
  return missingFields(resident, code)
}

export const issuanceApi = {
  async searchResidents(query = ""): Promise<ResidentRecord[]> {
    const q = query.trim().toLowerCase()
    return residents.filter((resident) => resident.status === "Active")
      .filter((resident) => !q || [resident.name, resident.id, resident.idNumber, resident.address].some((value) => value.toLowerCase().includes(q)))
  },

  async createResident(input: QuickResidentInput): Promise<ResidentRecord> {
    const sequence = residents.reduce((max, resident) => Math.max(max, Number(resident.id.match(/\d+$/)?.[0] ?? 0)), 0) + 1
    const name = [input.firstName, input.middleName?.trim(), input.lastName].filter(Boolean).join(" ")
    const address = [input.houseNumber?.trim(), input.street.trim(), `Purok ${input.purok}`, "Mayondon"].filter(Boolean).join(", ")
    const resident: ResidentRecord = {
      id: `RES-${String(sequence).padStart(4, "0")}`,
      name,
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim() ?? "",
      lastName: input.lastName.trim(),
      birthdate: input.birthdate,
      birthplace: "",
      sex: input.sex,
      civilStatus: input.civilStatus,
      sectors: [],
      residentSince: input.residentSinceBirth ? 0 : input.residentSinceYear ?? 0,
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
    return resident
  },

  async updateResident(id: string, patch: ResidentPatch): Promise<ResidentRecord> {
    const current = residents.find((resident) => resident.id === id)
    if (!current) throw new Error("Resident record was not found.")
    const updated = { ...current, ...patch, name: [patch.firstName ?? current.firstName, patch.middleName ?? current.middleName, patch.lastName ?? current.lastName].filter(Boolean).join(" ") }
    residents = residents.map((resident) => resident.id === id ? updated : resident)
    return updated
  },

  async getLookups(): Promise<IssuanceLookups> {
    const { clearancePurposeOptions, indigencySectorOptions, idTypeOptions, civilStatusOptions } = await import("@/components/Issuances/config")
    const { initialOfficials } = await import("@/components/Officials/officials-sample-data")
    return {
      documentTypes: Object.values(documentConfig),
      purposes: [...clearancePurposeOptions],
      sectors: [...indigencySectorOptions],
      idTypes: [...new Set(["CTC", ...idTypeOptions])],
      puroks: ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6"],
      streets: [...streets],
      associations: [...associations],
      officials: initialOfficials.filter((official) => official.status === "Current").map(({ id, name, position }) => ({ id, name, position })),
      civilStatuses: [...civilStatusOptions],
    }
  },

  async checkIssuance(residentId: string, documentType: DocumentCode): Promise<IssuanceCheck> {
    const resident = residents.find((item) => item.id === residentId)
    if (!resident) throw new Error("Select a resident record first.")
    const existing = documentConfig[documentType].onePerResident
      ? issuances.find((item) => item.residentId === residentId && item.documentType === documentType && item.status === "issued")
      : undefined
    return {
      existingIssued: existing ? { referenceNo: existing.referenceNo, issueDate: existing.issueDate } : undefined,
      missingResidentFields: missingFields(resident, documentType),
    }
  },

  async getTricycles(plate = "", motor = "") {
    return { plate, motor, match: undefined as undefined }
  },

  async createIssuance(input: IssuanceInput): Promise<CreateIssuanceResult> {
    const parsed = input.status === "draft" ? input : issuanceInputSchema.parse(input)
    if (parsed.status === "issued") {
      const check = await this.checkIssuance(parsed.residentId, parsed.documentType)
      if (check.existingIssued) {
        throw Object.assign(new Error(`An issued ${documentConfig[parsed.documentType].shortName} already exists: ${check.existingIssued.referenceNo} (${check.existingIssued.issueDate}).`), { status: 409, existing: check.existingIssued })
      }
    }
    const resident = residents.find((item) => item.id === parsed.residentId)
    if (!resident) throw new Error("Select a resident record first.")
    if (parsed.residentUpdates) {
      await this.updateResident(resident.id, parsed.residentUpdates as ResidentPatch)
    }
    const updatedResident = residents.find((item) => item.id === parsed.residentId) ?? resident
    const sequence = issuances.length + 1
    const record: MockIssuance = {
      id: `mock-issuance-${sequence}`,
      referenceNo: `ISS-${new Date().getFullYear()}-${String(sequence).padStart(6, "0")}`,
      documentType: parsed.documentType,
      residentId: parsed.residentId,
      residentName: [updatedResident.firstName, updatedResident.middleName, updatedResident.lastName].filter(Boolean).join(" "),
      issueDate: parsed.issueDate,
      status: parsed.status,
      payload: parsed,
      ...(parsed.status === "issued" ? {
        residentSnapshot: {
          fullName: [updatedResident.firstName, updatedResident.middleName, updatedResident.lastName].filter(Boolean).join(" "),
          addressLine: snapshotAddress(updatedResident),
          birthDate: updatedResident.birthdate || undefined,
          birthPlace: updatedResident.birthplace || undefined,
          sex: updatedResident.sex,
          civilStatus: updatedResident.civilStatus,
          residentSinceYear: updatedResident.residentSince || undefined,
          residentSinceBirth: updatedResident.residentSince === 0,
        },
        issuedAt: new Date().toISOString(),
      } : {}),
    }
    issuances = [record, ...issuances]
    return record
  },

  async listIssuances() {
    return issuances.map(({ payload, ...record }) => ({
      ...record,
      payload: {
        ...payload,
        details: payload.details.type === "MARGINALIZED_SECTOR"
          ? { type: "MARGINALIZED_SECTOR" as const, healthCondition: "[restricted]" }
          : payload.details,
      },
    }))
  },

  async getIssuance(id: string) {
    return issuances.find((item) => item.id === id)
  },

  async updateDraft(id: string, input: IssuanceInput) {
    const existing = issuances.find((item) => item.id === id)
    if (!existing || existing.status !== "draft") throw new Error("Only drafts can be edited.")
    const parsed = issuanceInputSchema.parse({ ...input, status: "draft" })
    const updated = { ...existing, payload: parsed, issueDate: parsed.issueDate, documentType: parsed.documentType, residentId: parsed.residentId }
    issuances = issuances.map((item) => item.id === id ? updated : item)
    return updated
  },
}

export const mockIssuanceStore = {
  reset() {
    residents = [...sampleResidents]
    issuances = []
    streets = ["Rizal Street", "Mabini Street", "Bonifacio Street"]
    associations = ["Mayondon Tricycle Operators and Drivers Association"]
  },
  addStreet(name: string) {
    const normalized = name.trim()
    if (normalized && !streets.some((street) => street.toLowerCase() === normalized.toLowerCase())) streets = [...streets, normalized]
    return [...streets]
  },
  addAssociation(name: string) {
    const normalized = name.trim()
    if (normalized && !associations.some((association) => association.toLowerCase() === normalized.toLowerCase())) associations = [...associations, normalized]
    return [...associations]
  },
}
