import { expect, test } from "@playwright/test"
import { documentDetailsSchema, documentDetailSchemas } from "@/components/Issuances/NewIssuance/schemas"
import { getMissingResidentFields } from "@/components/Issuances/NewIssuance/issuanceApi"
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
  ])
  expect(getMissingResidentFields(resident, "FRANCHISE_CLEARANCE")).toEqual(["address"])
})
