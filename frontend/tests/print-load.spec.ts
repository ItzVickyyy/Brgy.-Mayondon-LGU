// Unit tests for loadPrintData (round 5): stored issuance -> PrintData through the mock API. No browser pages.
import { expect, test } from "@playwright/test"
import {
  issuanceApi,
  mockIssuanceStore,
} from "../src/components/Issuances/NewIssuance/issuanceApi.mock"
import { loadPrintData } from "../src/lib/print/loadPrintData"
import { printOverlayCss } from "../src/lib/print/overlayStyles"

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

test.beforeEach(() => mockIssuanceStore.reset())
test.afterEach(() => mockIssuanceStore.reset())

test("clearance loads name, purpose and photo", async () => {
  const resident = await seedResident()
  const record = await issuanceApi.createIssuance({
    documentType: "BARANGAY_CLEARANCE",
    issueDate: "2026-11-03",
    residentId: resident.id,
    purposeText: "Employment Requirement",
    identification: {
      idTypeId: 2,
      idNumber: "SYN-001",
      placeOfIssue: "Los Baños, Laguna",
      dateOfIssue: "2026-11-03",
    },
    payment: { officialReceiptNo: "FOC", isFree: true },
    details: { type: "BARANGAY_CLEARANCE" },
    status: "issued",
  })
  const result = await loadPrintData(record.id, issuanceApi)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.templateId).toBe("clearance")
  expect(result.data.values.name).toBe("RESIDENT, FICTIONAL A.")
  expect(result.data.values.purpose).toBe("Employment Requirement")
  expect(result.data.photoUrl).toBe("data:image/jpeg;base64,dGVzdA==")
})

test("franchise resolves the stored tricycle and association", async () => {
  const resident = await seedResident()
  const record = await issuanceApi.createIssuance({
    documentType: "FRANCHISE_CLEARANCE",
    issueDate: "2026-11-03",
    residentId: resident.id,
    details: {
      type: "FRANCHISE_CLEARANCE",
      associationName: "Sample Association",
      make: "Honda",
      bodyType: "TRICYCLE",
      motorNumber: "MOTOR-001",
      color: "Blue",
      plateNumber: "ABC-1234",
    },
    identification: {
      idTypeId: 2,
      idNumber: "SYN-001",
      placeOfIssue: "Los Baños, Laguna",
      dateOfIssue: "2026-11-03",
    },
    payment: { officialReceiptNo: "FOC", isFree: true },
    status: "issued",
  })
  const result = await loadPrintData(record.id, issuanceApi)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.templateId).toBe("franchise")
  expect(Object.values(result.data.values)).toEqual(
    expect.arrayContaining([
      "Sample Association",
      "Honda",
      "MOTOR-001",
      "ABC-1234",
    ]),
  )
})

test("unknown, voided and template-less documents return a message instead of throwing", async () => {
  const resident = await seedResident()
  expect(await loadPrintData("nope", issuanceApi)).toMatchObject({ ok: false })

  const residency = await issuanceApi.createIssuance({
    documentType: "RESIDENCY",
    issueDate: "2026-11-03",
    residentId: resident.id,
    purposeText: "Employment Requirement",
    signatoryOfficialId: "OFF-002",
    details: { type: "RESIDENCY" },
    status: "issued",
  })
  expect(await loadPrintData(residency.id, issuanceApi)).toMatchObject({
    ok: false,
    message: expect.stringContaining("no print template"),
  })

  const clearance = await issuanceApi.createIssuance({
    documentType: "BARANGAY_CLEARANCE",
    issueDate: "2026-11-03",
    residentId: resident.id,
    purposeText: "Employment Requirement",
    identification: {
      idTypeId: 2,
      idNumber: "SYN-001",
      placeOfIssue: "Los Baños, Laguna",
      dateOfIssue: "2026-11-03",
    },
    payment: { officialReceiptNo: "FOC", isFree: true },
    details: { type: "BARANGAY_CLEARANCE" },
    status: "issued",
  })
  await issuanceApi.voidIssuance(clearance.id, "test", "admin")
  expect(await loadPrintData(clearance.id, issuanceApi)).toMatchObject({
    ok: false,
    message: expect.stringContaining("voided"),
  })
})

test("print CSS re-shows the overlay over the Issuances page's `body *` visibility rule", () => {
  expect(printOverlayCss).toContain(
    ".print-overlay-root, .print-overlay-root * { visibility: visible !important }",
  )
})
