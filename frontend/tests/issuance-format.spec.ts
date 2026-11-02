// Unit tests for pure issuance formatting helpers.
import { expect, test } from "@playwright/test"
import { calculateAge, formatPrintedName } from "../src/lib/issuance-format"

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
