// Unit tests for the print data builder (pure, no browser pages).
import { expect, test } from "@playwright/test"
import { buildPrintData, type PrintLookups } from "../src/lib/print/buildPrintData"
import { printTemplates } from "../src/lib/print/templates"
import type { MockIssuance } from "../src/components/Issuances/NewIssuance/issuanceApi"

const lookups: PrintLookups = {
  sectors: ["Senior Citizen", "PWD", "Solo Parent"],
  idTypes: ["CTC", "Driver's License"],
  purposes: ["Employment", "Scholarship"],
  tricycle: { association: "Mayondon TODA", make: "Honda", bodyType: "Sidecar", motorNumber: "M123", color: "Blue", plateNumber: "AB1234" },
}
const resident: NonNullable<MockIssuance["residentSnapshot"]> = {
  fullName: "Juan Santos Dela Cruz", addressLine: "12 Rizal Street, Purok 2", birthDate: "2000-03-01", birthPlace: "Nagcarlan",
  civilStatus: "Single", photoUrl: "data:image/png;base64,AAA", residentSinceBirth: false, residentSinceYear: 2010,
}
const make = (documentType: MockIssuance["documentType"], payload: Record<string, unknown>): MockIssuance => ({
  id: "1", referenceNo: "R-1", documentType, residentId: "RES-1", issueDate: "2026-11-04", status: "issued",
  payload: { documentType, issueDate: "2026-11-04", residentId: "RES-1", status: "issued", ...payload } as MockIssuance["payload"],
  residentSnapshot: resident,
})
const name = { firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz" }

test.describe("buildPrintData", () => {
  test("clearance uses LAST, FIRST format, age and photo", () => {
    const data = buildPrintData(make("BARANGAY_CLEARANCE", {
      purposeId: 1, remarks: "NO DEROGATORY RECORD ON FILE", details: { type: "BARANGAY_CLEARANCE" },
      identification: { idTypeId: 2, idNumber: "N01", placeOfIssue: "Manila", dateOfIssue: "2024-01-05" },
      payment: { isFree: false, officialReceiptNo: "OR-9" },
    }), lookups, name)!
    expect(data.templateId).toBe("clearance")
    expect(data.values).toMatchObject({
      name: "DELA CRUZ, JUAN SANTOS", age: "26 years old", birthdate: "March 1, 2000", date: "November 4, 2026",
      purpose: "Employment", idType: "Driver's License", idDate: "January 5, 2024", orNumber: "OR-9",
    })
    expect(data.photoUrl).toBe(resident.photoUrl)
  })

  test("indigency supplies the SECTOR label and joins sectors", () => {
    const data = buildPrintData(make("INDIGENCY", {
      purposeId: 2, sectors: [{ sectorId: 1 }, { sectorId: 3 }], details: { type: "INDIGENCY", addressedToOffice: "PhilHealth" },
    }), lookups, name)!
    expect(data.values.sectorLine).toBe("SECTOR : Senior Citizen / Solo Parent")
    expect(data.values.name).toBe("JUAN S. DELA CRUZ")
    expect(data.values.addressedTo).toBe("PhilHealth")
    expect(data.photoUrl).toBeUndefined()
  })

  test("utility sets marks values and franchise reads the tricycle lookup", () => {
    const utility = buildPrintData(make("UTILITY_CLEARANCE", {
      details: { type: "UTILITY_CLEARANCE", services: ["water"], connectionType: "reconnection", classification: "commercial", location: "Purok 1" },
    }), lookups, name)!
    expect(utility.values).toMatchObject({ water: "yes", connectionType: "Reconnection", classification: "Commercial", location: "Purok 1" })
    expect(utility.values.electric).toBe("")
    const franchise = buildPrintData(make("FRANCHISE_CLEARANCE", { details: { type: "FRANCHISE_CLEARANCE", tricycleId: "TRI-1" } }), lookups, name)!
    expect(franchise.values).toMatchObject({ association: "Mayondon TODA", plateNumber: "AB1234", make: "Honda" })
  })

  test("assistance computes years and the beneficiary", () => {
    const data = buildPrintData(make("ASSISTANCE", {
      sectors: [{ sectorId: 2 }],
      details: { type: "ASSISTANCE", assistanceType: "medical", forSelf: false, beneficiaryName: "Maria Cruz", beneficiaryRelationship: "mother" },
    }), lookups, name)!
    expect(data.values).toMatchObject({ assistanceType: "Medical", for: "Someone else", years: "16", underName: "Maria Cruz", relationship: "mother", sector: "PWD", day: "4", month: "November" })
  })

  test("only template keys are returned, unsupported documents give null, falls back to snapshot name", () => {
    expect(buildPrintData(make("RESIDENCY", { details: { type: "RESIDENCY" } }), lookups)).toBeNull()
    const data = buildPrintData(make("MARGINALIZED_SECTOR", { sectors: [{ sectorId: 2 }], details: { type: "MARGINALIZED_SECTOR", healthCondition: "Asthma" } }), lookups)!
    const allowed = new Set(printTemplates.marginalized.fields.map((f) => f.key))
    expect(Object.keys(data.values).every((key) => allowed.has(key))).toBe(true)
    expect(data.values).toMatchObject({ name: "JUAN SANTOS DELA CRUZ", healthCondition: "Asthma" })
  })
})
