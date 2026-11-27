// Unit tests for the print data builder (pure, no browser pages).
import { expect, test } from "@playwright/test"
import type { MockIssuance } from "../src/components/Issuances/NewIssuance/issuanceApi"
import {
  buildPrintData,
  ordinal,
  type PrintLookups,
  wrapLines,
} from "../src/lib/print/buildPrintData"
import { printTemplates } from "../src/lib/print/templates"

const lookups: PrintLookups = {
  sectors: [
    { id: 1, name: "Senior Citizen" },
    { id: 2, name: "PWD" },
    { id: 3, name: "Solo Parent" },
  ],
  idTypes: [
    { id: 1, name: "CTC" },
    { id: 2, name: "Driver's License" },
  ],
  purposes: [
    { id: 1, name: "Employment" },
    { id: 2, name: "Scholarship" },
  ],
  officials: [
    { id: "o1", name: "Juan Official", position: "Punong Barangay" },
    { id: "o2", name: "Hon. Ana Reyes", position: "Barangay Kagawad" },
  ],
  tricycle: {
    association: "Mayondon TODA",
    make: "Honda",
    bodyType: "Sidecar",
    motorNumber: "M123",
    color: "Blue",
    plateNumber: "AB1234",
  },
}
const resident: NonNullable<MockIssuance["residentSnapshot"]> = {
  fullName: "Juan Santos Dela Cruz",
  addressLine: "12 Rizal Street, Purok 2",
  birthDate: "2000-03-01",
  birthPlace: "Nagcarlan",
  civilStatus: "Single",
  photoUrl: "data:image/png;base64,AAA",
  residentSinceBirth: false,
  residentSinceYear: 2010,
}
const make = (
  documentType: MockIssuance["documentType"],
  payload: Record<string, unknown>,
): MockIssuance => ({
  id: "1",
  referenceNo: "R-1",
  documentType,
  residentId: "RES-1",
  issueDate: "2026-11-04",
  status: "issued",
  payload: {
    documentType,
    issueDate: "2026-11-04",
    residentId: "RES-1",
    status: "issued",
    ...payload,
  } as MockIssuance["payload"],
  residentSnapshot: resident,
})
const name = { firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz" }

test.describe("buildPrintData", () => {
  test("clearance uses LAST, FIRST format, age and photo", () => {
    const data = buildPrintData(
      make("BARANGAY_CLEARANCE", {
        purposeId: 1,
        remarks: "NO DEROGATORY RECORD ON FILE",
        details: { type: "BARANGAY_CLEARANCE" },
        identification: {
          idTypeId: 2,
          idNumber: "N01",
          placeOfIssue: "Manila",
          dateOfIssue: "2024-01-05",
        },
        payment: { isFree: false, officialReceiptNo: "OR-9" },
      }),
      lookups,
      name,
    )!
    expect(data.templateId).toBe("clearance")
    expect(data.values).toMatchObject({
      name: "DELA CRUZ, JUAN SANTOS",
      age: "26 years old",
      birthdate: "March 1, 2000",
      date: "November 4, 2026",
      purpose: "Employment",
      idType: "Driver's License",
      idDate: "January 5, 2024",
      orNumber: "OR-9",
    })
    expect(data.photoUrl).toBe(resident.photoUrl)
  })

  test("indigency supplies the SECTOR label and joins sectors", () => {
    const data = buildPrintData(
      make("INDIGENCY", {
        purposeId: 2,
        sectors: [{ sectorId: 1 }, { sectorId: 3 }],
        details: { type: "INDIGENCY", addressedToOffice: "PhilHealth" },
      }),
      lookups,
      name,
    )!
    expect(data.values.sectorLabel).toBe("SECTOR")
    expect(data.values.sectorColon).toBe(":")
    expect(data.values.sector).toBe("Senior Citizen / Solo Parent")
    expect(data.values.name).toBe("JUAN S. DELA CRUZ")
    expect(data.values.addressedTo).toBe("PhilHealth")
    expect(data.photoUrl).toBeUndefined()
  })

  test("names are found by id, so a removed list item leaves no gap that shifts the others", () => {
    // ids 1 and 2 were removed from each list; the saved ids are 4, 7 and 9
    const gaps: PrintLookups = {
      sectors: [
        { id: 4, name: "Senior Citizen" },
        { id: 9, name: "Solo Parent" },
      ],
      idTypes: [{ id: 7, name: "Driver's License" }],
      purposes: [{ id: 4, name: "Employment" }],
    }
    const data = buildPrintData(
      make("BARANGAY_CLEARANCE", {
        purposeId: 4,
        details: { type: "BARANGAY_CLEARANCE" },
        identification: {
          idTypeId: 7,
          idNumber: "N01",
          placeOfIssue: "Manila",
          dateOfIssue: "2024-01-05",
        },
      }),
      gaps,
      name,
    )!
    expect(data.values).toMatchObject({
      purpose: "Employment",
      idType: "Driver's License",
    })
    const indigency = buildPrintData(
      make("INDIGENCY", {
        purposeId: 4,
        sectors: [{ sectorId: 9 }, { sectorId: 4 }],
        details: { type: "INDIGENCY", addressedToOffice: "PhilHealth" },
      }),
      gaps,
      name,
    )!
    expect(indigency.values.sectorLabel).toBe("SECTOR")
    expect(indigency.values.sectorColon).toBe(":")
    expect(indigency.values.sector).toBe("Solo Parent / Senior Citizen")
    // an id that is no longer in the list prints nothing rather than another item's name
    const missing = buildPrintData(
      make("INDIGENCY", {
        sectors: [{ sectorId: 2 }],
        details: { type: "INDIGENCY", addressedToOffice: "PhilHealth" },
      }),
      gaps,
      name,
    )!
    expect(missing.values.sector).toBe("")
    expect(missing.values.sectorLabel).toBe("")
    expect(missing.values.sectorColon).toBe("")
  })

  test("utility sets marks values and franchise reads the tricycle lookup", () => {
    const utility = buildPrintData(
      make("UTILITY_CLEARANCE", {
        details: {
          type: "UTILITY_CLEARANCE",
          services: ["water"],
          connectionType: "reconnection",
          classification: "commercial",
          location: "Purok 1",
        },
      }),
      lookups,
      name,
    )!
    expect(utility.values).toMatchObject({
      water: "yes",
      connectionType: "Reconnection",
      classification: "Commercial",
      location: "Purok 1",
    })
    expect(utility.values.electric).toBe("")
    const franchise = buildPrintData(
      make("FRANCHISE_CLEARANCE", {
        details: { type: "FRANCHISE_CLEARANCE", tricycleId: "TRI-1" },
      }),
      lookups,
      name,
    )!
    expect(franchise.values).toMatchObject({
      association: "Mayondon TODA",
      plateNumber: "AB1234",
      make: "Honda",
    })
  })

  test("assistance computes years and the beneficiary", () => {
    const data = buildPrintData(
      make("ASSISTANCE", {
        sectors: [{ sectorId: 2 }],
        details: {
          type: "ASSISTANCE",
          assistanceType: "medical",
          forSelf: false,
          beneficiaryName: "Maria Cruz",
          beneficiaryRelationship: "mother",
        },
      }),
      lookups,
      name,
    )!
    expect(data.values).toMatchObject({
      assistanceType: "Medical",
      for: "Someone else",
      years: "16",
      underName: "Maria Cruz",
      relationship: "mother",
      sector: "PWD",
      day: "4",
      month: "November",
    })
  })

  test("only template keys are returned, unsupported documents give null, falls back to snapshot name", () => {
    expect(
      buildPrintData(
        make("BARANGAY_ID", {
          details: { type: "BARANGAY_ID", transactionType: "new" },
        }),
        lookups,
      ),
    ).toBeNull()
    const data = buildPrintData(
      make("ASSISTANCE", {
        sectors: [{ sectorId: 2 }],
        details: {
          type: "ASSISTANCE",
          assistanceType: "medical",
          forSelf: true,
          healthCondition: "Asthma",
        },
      }),
      lookups,
    )!
    const allowed = new Set([
      ...printTemplates.assistance.fields.map((f) => f.key),
      ...(printTemplates.assistance.marks ?? []).map((m) => m.key),
    ])
    expect(Object.keys(data.values).every((key) => allowed.has(key))).toBe(true)
    expect(data.values).toMatchObject({
      name: "JUAN SANTOS DELA CRUZ",
      assistanceType: "Medical",
    })
    // The health condition is confidential: stored, never printed.
    expect(JSON.stringify(data.values)).not.toContain("Asthma")
  })

  test("Residency: since, statement lines, FOC, ID presented, signatory", () => {
    const statement = "He has lived in this barangay without a break. "
      .repeat(8)
      .trim()
    const data = buildPrintData(
      make("RESIDENCY", {
        purposeId: 1,
        signatoryOfficialId: "o1",
        identification: {
          idTypeId: 1,
          idNumber: "123",
          placeOfIssue: "Los Baños",
          dateOfIssue: "2026-01-02",
        },
        payment: { officialReceiptNo: "OR-9", isFree: true },
        details: { type: "RESIDENCY", additionalStatement: statement },
      }),
      lookups,
    )!
    expect(data.templateId).toBe("residency")
    expect(data.values).toMatchObject({
      since: "2010",
      purpose: "Employment",
      dayOrdinal: "4th",
      yearShort: "26",
      orNumber: "FOC",
      idPresented: "CTC: 123",
      signatoryName: "HON. JUAN OFFICIAL",
      signatoryPosition: "Punong Barangay",
    })
    const lines = Object.entries(data.values).filter(([key]) =>
      key.startsWith("statement"),
    )
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.length).toBeLessThanOrEqual(6)
    expect(lines.map(([, line]) => line).join(" ")).toBe(statement)
    const since = buildPrintData(
      {
        ...make("RESIDENCY", { details: { type: "RESIDENCY" } }),
        residentSnapshot: { ...resident, residentSinceBirth: true },
      },
      lookups,
    )!
    expect(since.values.since).toBe("birth")
    expect(since.values.signatoryName).toBeUndefined() // no official chosen: left for handwriting
    const paid = buildPrintData(
      make("RESIDENCY", {
        payment: { officialReceiptNo: "OR-9", isFree: false },
        details: { type: "RESIDENCY" },
      }),
      lookups,
    )!
    expect(paid.values.orNumber).toBe("OR-9")
  })

  test("Jobseeker: values for all three sheets, the witness is never printed", () => {
    const data = buildPrintData(
      make("FIRST_TIME_JOBSEEKER", {
        signatoryOfficialId: "o2",
        details: {
          type: "FIRST_TIME_JOBSEEKER",
          educationalAttainment: "College Graduate",
          course: "BS Biology",
          isJobstartBeneficiary: false,
          witnessName: "Staff Member",
        },
      }),
      lookups,
      { firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz" },
    )!
    expect(data.templateId).toBe("jobseeker")
    expect(data.values).toMatchObject({
      name: "JUAN S. DELA CRUZ",
      ageNumber: "26",
      yearsResident: "16 years",
      educationalAttainment: "College Graduate",
      course: "BS Biology",
      jobstart: "no",
      addressLine1: "12 Rizal Street, Purok 2",
      signatoryName: "HON. ANA REYES", // not doubled
    })
    expect(JSON.stringify(data.values)).not.toContain("Staff Member")
    expect(
      buildPrintData(
        make("FIRST_TIME_JOBSEEKER", {
          details: {
            type: "FIRST_TIME_JOBSEEKER",
            educationalAttainment: "x",
            course: "N/A",
            isJobstartBeneficiary: true,
          },
        }),
        lookups,
      )!.values.jobstart,
    ).toBe("yes")
    const pages = new Set(
      printTemplates.jobseeker.fields.map((f) => f.page ?? 0),
    )
    expect([...pages].sort()).toEqual([0, 1, 2])
  })

  test("ordinal days and line wrapping", () => {
    expect(
      ["1", "2", "3", "4", "11", "12", "13", "21", "22", "23", "31"].map(
        ordinal,
      ),
    ).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ])
    expect(ordinal("")).toBe("")
    expect(wrapLines("aaa bbb ccc ddd", [7], 5)).toEqual(["aaa bbb", "ccc ddd"])
    expect(wrapLines("aaa bbb ccc ddd", [7], 1)).toEqual(["aaa bbb ccc ddd"])
    expect(wrapLines("", [7], 3)).toEqual([])
  })

  test("clearances carry the stamp box values; a free certificate reads FOC", () => {
    const paid = buildPrintData(
      make("BARANGAY_CLEARANCE", {
        details: { type: "BARANGAY_CLEARANCE" },
        payment: {
          isFree: false,
          officialReceiptNo: "0359328",
          dateOfPayment: "2026-09-15",
          certifiedBy: "KRGV",
        },
      }),
      lookups,
      name,
    )!
    expect(paid.values).toMatchObject({
      stampOr: "0359328",
      stampDate: "09/15/2026",
      stampBy: "KRGV",
    })
    const free = buildPrintData(
      make("FRANCHISE_CLEARANCE", {
        details: { type: "FRANCHISE_CLEARANCE" },
        payment: { isFree: true, officialReceiptNo: "" },
      }),
      lookups,
      name,
    )!
    expect(free.values.stampOr).toBe("FOC")
  })

  test("clearance prints the loan note and FOC as the xls does", () => {
    const base = {
      remarks: "NO DEROGATORY RECORD ON FILE",
      details: { type: "BARANGAY_CLEARANCE" as const },
    }
    const free = buildPrintData(
      make("BARANGAY_CLEARANCE", {
        ...base,
        purposeId: 1,
        payment: { isFree: true, officialReceiptNo: "" },
      }),
      lookups,
      name,
    )!
    expect(free.values.orNumber).toBe("FOC")
    expect(free.values.purposeNote).toBe("NOT APPLICABLE FOR LOAN PURPOSES")
    expect(free.values.remarks).toBe("NO DEROGATORY RECORD ON FILE")
    const franchise = buildPrintData(
      make("FRANCHISE_CLEARANCE", {
        details: { type: "FRANCHISE_CLEARANCE" },
        payment: { isFree: true, officialReceiptNo: "" },
      }),
      lookups,
      name,
    )!
    expect(franchise.values.orNumber).toBe("")
    expect(franchise.values.purposeNote ?? "").toBe("")
  })

  test("a free Utility Clearance prints FOC beside the receipt number", () => {
    const details = {
      type: "UTILITY_CLEARANCE" as const,
      location: "Purok 2",
      services: ["electric" as const],
      connectionType: "new" as const,
      classification: "residential" as const,
    }
    const free = buildPrintData(
      make("UTILITY_CLEARANCE", {
        details,
        payment: { isFree: true, officialReceiptNo: "" },
      }),
      lookups,
      name,
    )!
    expect(free.values.orNumber).toBe("FOC")
    const paid = buildPrintData(
      make("UTILITY_CLEARANCE", {
        details,
        payment: { isFree: false, officialReceiptNo: "OR-9" },
      }),
      lookups,
      name,
    )!
    expect(paid.values.orNumber).toBe("OR-9")
  })
})
