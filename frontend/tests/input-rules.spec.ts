import { expect, test } from "@playwright/test"

import {
  allowsChar,
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
