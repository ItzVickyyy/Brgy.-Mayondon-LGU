import { expect, test } from "@playwright/test"
import { documentDetailsSchema, documentDetailSchemas } from "@/components/Issuances/NewIssuance/schemas"
import { getMissingResidentFields, issuanceApi, mockIssuanceStore } from "@/components/Issuances/NewIssuance/issuanceApi.mock"
import type { DocumentCode } from "@/components/Issuances/NewIssuance/documentConfig"
import type { ResidentRecord } from "@/components/Records/records-sample-data"

const validDetails = {
  BARANGAY_CLEARANCE: { type: "BARANGAY_CLEARANCE" },
  FRANCHISE_CLEARANCE: { type: "FRANCHISE_CLEARANCE", associationName: "Sample Association", make: "Sample Make", bodyType: "TRICYCLE", motorNumber: "MOTOR-001", color: "Blue", plateNumber: "ABC-1234" },
  UTILITY_CLEARANCE: { type: "UTILITY_CLEARANCE", services: ["electric"], connectionType: "new", classification: "residential", location: "Barangay Mayondon" },
  RESIDENCY: { type: "RESIDENCY" },
  INDIGENCY: { type: "INDIGENCY", addressedToOffice: "Sample Office" },
  ASSISTANCE: { type: "ASSISTANCE", assistanceType: "financial", forSelf: true },
  MARGINALIZED_SECTOR: { type: "MARGINALIZED_SECTOR", healthCondition: "Fictional test condition" },
  FIRST_TIME_JOBSEEKER: { type: "FIRST_TIME_JOBSEEKER", educationalAttainment: "College", course: "N/A", isJobstartBeneficiary: false, witnessOfficialId: "OFF-SAMPLE-01", parts: ["applicant_sheet", "oath", "certification"] },
  BARANGAY_ID: { type: "BARANGAY_ID", transactionType: "new", validUntil: "2027-11-03" },
} as const

const codes = Object.keys(validDetails) as DocumentCode[]

async function seedResident() {
  const resident = await issuanceApi.createResident({
    firstName: "Fictional",
    middleName: "A.",
    lastName: "Resident",
    birthdate: "1990-01-01",
    birthplace: "Los Baños, Laguna",
    sex: "Female",
    civilStatus: "Single",
    houseNumber: "12",
    street: "Rizal Street",
    purok: 1,
    residentSinceYear: 2010,
    residentSinceBirth: false,
  })
  await issuanceApi.updateResident(resident.id, {
    photoUrl: "data:image/jpeg;base64,dGVzdA==",
    sectors: ["Senior Citizen"],
  })
  return resident
}

for (const code of codes) {
  test(`${code} accepts a valid detail payload`, () => {
    expect(documentDetailSchemas[code].safeParse(validDetails[code]).success).toBe(true)
  })

  test(`${code} rejects a mismatched detail type`, () => {
    expect(documentDetailSchemas[code].safeParse({ type: "NOT_A_DOCUMENT" }).success).toBe(false)
  })
}

test("assistance requires beneficiary details when the request is for someone else", () => {
  expect(documentDetailsSchema.safeParse({
    type: "ASSISTANCE",
    assistanceType: "medical",
    forSelf: false,
  }).success).toBe(false)
})

test("First-Time Jobseeker rejects an empty educational attainment", () => {
  expect(documentDetailSchemas.FIRST_TIME_JOBSEEKER.safeParse({
    type: "FIRST_TIME_JOBSEEKER",
    educationalAttainment: "",
    course: "N/A",
    isJobstartBeneficiary: false,
    witnessOfficialId: "OFF-SAMPLE-01",
    parts: ["applicant_sheet"],
  }).success).toBe(false)
})

test("missing resident fields reports only fields required by the selected document", () => {
  const resident: ResidentRecord = {
    id: "RES-TEST-0001",
    name: "Fictional Resident",
    firstName: "Fictional",
    middleName: "",
    lastName: "Resident",
    birthdate: "",
    birthplace: "",
    sex: "Female",
    civilStatus: "",
    sectors: [],
    residentSince: 0,
    address: "",
    residentType: "Existing resident",
    idNumber: "",
    idStatus: "None",
    registration: "Unregistered",
    status: "Active",
  }

  expect(getMissingResidentFields(resident, "BARANGAY_CLEARANCE")).toEqual([
    "address",
    "birthDate",
    "birthPlace",
    "civilStatus",
    "photo",
  ])
  expect(getMissingResidentFields(resident, "FRANCHISE_CLEARANCE")).toEqual(["address"])
})


test("First-Time Jobseeker is limited to one issued record per resident", async () => {
  mockIssuanceStore.reset()
  await seedResident()
  const input = {
    documentType: "FIRST_TIME_JOBSEEKER" as const,
    issueDate: "2026-11-03",
    residentId: "RES-0001",
    signatoryOfficialId: "OFF-001",
    details: {
      type: "FIRST_TIME_JOBSEEKER" as const,
      educationalAttainment: "College",
      course: "N/A",
      isJobstartBeneficiary: false,
      witnessOfficialId: "OFF-006",
      parts: ["applicant_sheet", "oath", "certification"] as ("applicant_sheet" | "oath" | "certification")[],
    },
    status: "issued" as const,
  }

  const first = await issuanceApi.createIssuance(input)
  expect(first.status).toBe("issued")
  await expect(issuanceApi.createIssuance(input)).rejects.toMatchObject({ status: 409 })
  mockIssuanceStore.reset()
})

test("issued records retain an issue-time resident snapshot", async () => {
  mockIssuanceStore.reset()
  await seedResident()
  const record = await issuanceApi.createIssuance({
    documentType: "BARANGAY_CLEARANCE",
    issueDate: "2026-11-03",
    residentId: "RES-0001",
    purposeText: "Employment Requirement",
    identification: { idTypeId: 2, idNumber: "SYNTHETIC-ID-001", placeOfIssue: "Los Baños, Laguna", dateOfIssue: "2026-11-03" },
    payment: { officialReceiptNo: "FOC", isFree: true },
    details: { type: "BARANGAY_CLEARANCE" },
    status: "issued",
  })
  expect(record.residentSnapshot?.fullName).toBe("Fictional A. Resident")
  expect(record.residentSnapshot?.addressLine).toBe("12 Rizal Street, Purok 1")
  mockIssuanceStore.reset()
})


test("history lists redact sensitive health conditions while authorized detail remains available", async () => {
  mockIssuanceStore.reset()
  await seedResident()
  const record = await issuanceApi.createIssuance({
    documentType: "MARGINALIZED_SECTOR",
    issueDate: "2026-11-03",
    residentId: "RES-0001",
    signatoryOfficialId: "OFF-002",
    sectors: [{ sectorId: 5, idNumber: "SYNTHETIC-SECTOR-ID" }],
    details: { type: "MARGINALIZED_SECTOR", healthCondition: "Fictional sensitive test value" },
    status: "issued",
  })
  const list = await issuanceApi.listIssuances()
  expect(list[0]?.payload.details).toEqual({ type: "MARGINALIZED_SECTOR", healthCondition: "[restricted]" })
  expect((await issuanceApi.getIssuance(record.id))?.payload.details).toEqual({ type: "MARGINALIZED_SECTOR", healthCondition: "Fictional sensitive test value" })
  mockIssuanceStore.reset()
})

test("mock void is admin-only and requires a reason", async () => {
  mockIssuanceStore.reset()
  await seedResident()
  const record = await issuanceApi.createIssuance({
    documentType: "BARANGAY_CLEARANCE",
    issueDate: "2026-11-03",
    residentId: "RES-0001",
    purposeText: "Employment Requirement",
    identification: { idTypeId: 2, idNumber: "SYNTHETIC-ID-002", placeOfIssue: "Los Baños, Laguna", dateOfIssue: "2026-11-03" },
    payment: { officialReceiptNo: "FOC", isFree: true },
    details: { type: "BARANGAY_CLEARANCE" },
    status: "issued",
  })
  await expect(issuanceApi.voidIssuance(record.id, "Not authorized", "staff")).rejects.toMatchObject({ status: 403 })
  await expect(issuanceApi.voidIssuance(record.id, "", "admin")).rejects.toThrow("A void reason is required.")
  await expect(issuanceApi.voidIssuance(record.id, "Synthetic correction reason", "admin")).resolves.toMatchObject({ status: "voided" })
  mockIssuanceStore.reset()
})
