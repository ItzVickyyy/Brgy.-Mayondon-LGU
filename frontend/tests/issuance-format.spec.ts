// Unit tests for pure issuance formatting helpers.
import { expect, test } from "@playwright/test"
import { calculateAge, formatPrintedName, daysInMonth, buildIsoDate, splitIsoDate, monthNames, isoToLocalDate, localDateToIso, formatPaperDate } from "../src/lib/issuance-format"
import { documentFields, documentMeta, documentSections, documentTypes, normalizeDocumentType } from "../src/components/Issuances/config"
import { getSignatories, getWitnesses } from "../src/components/Officials/officials-sample-data"
import { getMissingFields } from "../src/components/Issuances/print-summary"
import { documentConfig, documentConfigList } from "../src/components/Issuances/NewIssuance/documentConfig"

test.describe("issuance formatting helpers", () => {
  test("calculates age before and after a birthday", () => {
    expect(calculateAge("2000-03-01", "2026-02-28")).toBe("25")
    expect(calculateAge("2000-03-01", "2026-03-01")).toBe("26")
  })

  test("handles February 29 birthdays", () => {
    expect(calculateAge("2000-02-29", "2021-02-28")).toBe("20")
    expect(calculateAge("2000-02-29", "2021-03-01")).toBe("21")
  })

  test("returns an empty age for missing, invalid, or future birthdates", () => {
    expect(calculateAge("", "2026-11-02")).toBe("")
    expect(calculateAge("not-a-date", "2026-11-02")).toBe("")
    expect(calculateAge("2030-01-01", "2026-11-02")).toBe("")
  })

  test("formats names according to the paper", () => {
    expect(formatPrintedName("Fictional", "A.", "Resident", "Barangay Clearance")).toBe("RESIDENT, FICTIONAL A.")
    expect(formatPrintedName("Fictional", "A.", "Resident", "Barangay Franchise Clearance")).toBe("FICTIONAL A. RESIDENT")
  })
})

test.describe("full-word date helpers", () => {
  test("calculates month lengths and leap years", () => {
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(1900, 2)).toBe(28)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(monthNames[10]).toBe("November")
  })

  test("builds only valid ISO dates", () => {
    expect(buildIsoDate("2026", "11", "2")).toBe("2026-11-02")
    expect(buildIsoDate("2026", "2", "30")).toBe("")
    expect(buildIsoDate("26", "11", "2")).toBe("")
  })

  test("splits valid ISO dates into select-friendly month and day values", () => {
    expect(splitIsoDate("2026-11-02")).toEqual({ year: "2026", month: "11", day: "2" })
    expect(splitIsoDate("invalid")).toEqual({ year: "", month: "", day: "" })
  })

  test("converts ISO dates to local dates and back without changing the calendar day", () => {
    const date = isoToLocalDate("1998-03-05")
    expect(date).toBeInstanceOf(Date)
    expect(date?.getFullYear()).toBe(1998)
    expect(date?.getMonth()).toBe(2)
    expect(date?.getDate()).toBe(5)
    expect(date ? localDateToIso(date) : "").toBe("1998-03-05")
    expect(isoToLocalDate("invalid")).toBeUndefined()
    expect(localDateToIso(new Date(Number.NaN))).toBe("")
  })

  test("formats date values in full paper format", () => {
    expect(formatPaperDate("2026-11-03")).toBe("November 3, 2026")
    expect(formatPaperDate("1998-03-05")).toBe("March 5, 1998")
  })
})

test.describe("issuance summary validation helpers", () => {
  test("normalizes historical document type names", () => {
    expect(normalizeDocumentType("Franchise Clearance")).toBe(normalizeDocumentType("Barangay Franchise Clearance"))
    expect(normalizeDocumentType("Barangay Clearance (Electrical and Water Connection)")).toBe(normalizeDocumentType("Barangay Clearance, Electrical and Water Connection"))
    expect(normalizeDocumentType("Assistance Request Certification")).toBe(normalizeDocumentType("Certification (assistance request)"))
  })

  test("reports required fields for an empty Barangay Clearance", () => {
    const missing = getMissingFields("Barangay Clearance", {}, documentFields["Barangay Clearance"])
    expect(missing.map((field) => field.label)).toEqual(expect.arrayContaining(["Date on document", "Name as printed", "ADDRESS", "BIRTHDATE", "BIRTHPLACE", "CIVIL STATUS", "PURPOSE", "Valid I.D. Presented", "Number", "Place of Issue", "Date of Issue", "Paid under OFFICIAL RECEIPT No."]))
  })

  test("does not require age or birthdate for Franchise Clearance", () => {
    const missing = getMissingFields("Barangay Franchise Clearance", {}, documentFields["Barangay Franchise Clearance"])
    expect(missing.some((field) => /age|birthdate/i.test(field.label))).toBe(false)
  })

  test("does not require Relationship when recipient is Oneself", () => {
    const values = { recipientChoice: "Oneself" }
    const fields = documentSections["Certification (assistance request)"].flatMap((section) => section.fields)
    expect(getMissingFields("Certification (assistance request)", values, fields).some((field) => field.name === "recipientRelationship")).toBe(false)
  })

  test("does not require manual age when Indigency has a birthdate", () => {
    const values = { birthdate: "2000-01-01", ageManual: "" }
    const fields = documentSections["Certificate of Indigency"].flatMap((section) => section.fields)
    expect(getMissingFields("Certificate of Indigency", values, fields).some((field) => field.name === "ageManual")).toBe(false)
  })
})


test.describe("document catalog metadata", () => {
  test("keeps document configuration and metadata in sync", () => {
    expect(documentConfigList.length).toBeGreaterThan(0)
    expect(documentConfigList.map((item) => item.code).sort()).toEqual(Object.keys(documentConfig).sort())
    expect(documentTypes.length).toBeGreaterThan(0)
    expect(Object.keys(documentMeta).sort()).toEqual([...documentTypes].sort())
    expect(documentConfig.BARANGAY_ID.category).toBe("id")
    expect(documentConfig.BARANGAY_ID.signatoryMode).toBe("none")
    expect(documentConfig.BARANGAY_CLEARANCE.validityMonths).toBe(2)
    expect(documentConfig.FIRST_TIME_JOBSEEKER.validityMonths).toBe(12)
    expect(documentMeta["Barangay Clearance"].validity).toEqual({ months: 2 })
    expect(documentMeta["First-Time Jobseeker Certification"].validity).toEqual({ years: 1 })
    expect(documentMeta["First-Time Jobseeker Certification"].paper.size).toBe("legal")
    expect(documentMeta["Marginalized Sector Certification (Pagpapatunay)"].language).toBe("fil")
  })

  test("maps older history names to the current catalog names", () => {
    expect(normalizeDocumentType("Damayan")).toBe("Certificate of Indigency")
    expect(normalizeDocumentType("Residency Certification")).toBe("Certification of Residency")
    expect(normalizeDocumentType("First-Time Jobseekers Certification")).toBe("First-Time Jobseeker Certification")
    expect(normalizeDocumentType("Marginalized Sector")).toBe("Marginalized Sector Certification (Pagpapatunay)")
  })

  test("returns no signatories until officials are configured", () => {
    const signatories = getSignatories()
    expect(signatories).toEqual([])
  })

  test("returns no witnesses until officials are configured", () => {
    const witnesses = getWitnesses()
    expect(witnesses).toEqual([])
  })
})
