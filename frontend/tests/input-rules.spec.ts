import { expect, test } from "@playwright/test"

import {
  allowsChar,
  isValidBirthdate,
  isValidName,
  isValidPhone,
  isValidPurok,
  isValidYear,
  sanitize,
} from "../src/lib/inputRules"
import { GO_TO, SHORTCUTS } from "../src/lib/shortcuts"

test.describe("input rules", () => {
  test("digits and year boxes keep only digits and respect the length", () => {
    expect(sanitize("digits", "12a-3 4e5")).toBe("12345")
    expect(sanitize("year", "20x24 99")).toBe("2024")
    expect(sanitize("digits", "123456", 2)).toBe("12")
    expect(allowsChar("digits", "e")).toBe(false)
    expect(allowsChar("digits", "7")).toBe(true)
  })

  test("phone keeps digits and separators, plus sign only first", () => {
    expect(sanitize("phone", "+63 917-123 4567abc")).toBe("+63 917-123 4567")
    expect(sanitize("phone", "09+17")).toBe("0917")
    expect(sanitize("phone", "0917   123")).toBe("0917 123")
    expect(isValidPhone("0917 123 4567")).toBe(true)
    expect(isValidPhone("+63 917 123 4567")).toBe(true)
    expect(isValidPhone("12345")).toBe(false)
  })

  test("a mobile number must have its real length, a landline keeps 7 to 13", () => {
    expect(isValidPhone("0917123456")).toBe(false)
    expect(isValidPhone("091712345678")).toBe(false)
    expect(isValidPhone("+63917123456")).toBe(false)
    expect(isValidPhone("+6391712345678")).toBe(false)
    expect(isValidPhone("+63 917 123 4567")).toBe(true)
    expect(isValidPhone("(049) 502-2443")).toBe(true)
    expect(isValidPhone("+63 49 536 0000")).toBe(true)
  })

  test("a name starts with a letter; a birthdate is from 1900 to today", () => {
    expect(isValidName("")).toBe(true)
    expect(isValidName("Niño")).toBe(true)
    expect(isValidName("Nin\u0303o")).toBe(true)
    expect(isValidName("De la Cruz-Santos, Jr.")).toBe(true)
    expect(isValidName("-Juan")).toBe(false)
    expect(isValidName(".")).toBe(false)
    expect(isValidBirthdate("", "2026-11-27")).toBe(true)
    expect(isValidBirthdate("1900-01-01", "2026-11-27")).toBe(true)
    expect(isValidBirthdate("1899-12-31", "2026-11-27")).toBe(false)
    expect(isValidBirthdate("2026-11-28", "2026-11-27")).toBe(false)
  })

  test("names allow letters and name marks, not digits or symbols", () => {
    expect(sanitize("name", "Ma. Niña D'Souza-Cruz, Jr.")).toBe(
      "Ma. Niña D'Souza-Cruz, Jr.",
    )
    expect(sanitize("name", "Juan123 <script>")).toBe("Juan script")
    expect(allowsChar("name", "5")).toBe(false)
    expect(allowsChar("name", "ñ")).toBe(true)
  })

  test("codes allow letters, digits, space, hyphen, slash and dot", () => {
    expect(sanitize("code", "AB-1234/5 .x")).toBe("AB-1234/5 .x")
    expect(sanitize("code", "OR#99$")).toBe("OR99")
  })

  test("year and purok checks", () => {
    const thisYear = new Date().getFullYear()
    expect(isValidYear("")).toBe(true)
    expect(isValidYear("1899")).toBe(false)
    expect(isValidYear(String(thisYear))).toBe(true)
    expect(isValidYear(String(thisYear + 1))).toBe(false)
    expect(isValidYear("20")).toBe(false)
    expect(isValidPurok("")).toBe(true)
    expect(isValidPurok("0")).toBe(false)
    expect(isValidPurok("7")).toBe(true)
    expect(isValidPurok("100")).toBe(false)
  })
})

test.describe("shortcut list", () => {
  test("every go-to key is listed once and points to a page", () => {
    for (const key of Object.keys(GO_TO)) {
      const listed = SHORTCUTS.filter(
        (item) => item.keys[0] === "G" && item.keys[2]?.toLowerCase() === key,
      )
      expect(listed, `G then ${key}`).toHaveLength(1)
    }
  })
})
