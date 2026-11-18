// Unit tests for the signed-in user's witness name and "Certified by" initials.
import { expect, test } from "@playwright/test"
import { userFullName, userInitials } from "../src/lib/userNames"

test("initials are the first letter of every word, upper case", () => {
  expect(
    userInitials({
      first_name: "Vic John",
      middle_name: "Oboza",
      last_name: "Salen",
      extension_name: "Jr.",
    }),
  ).toBe("VJOSJ")
})

test("initials skip empty parts and extra spaces, and upper-case lower-case names", () => {
  expect(
    userInitials({
      first_name: "  ana  ",
      middle_name: null,
      last_name: "de la Cruz",
      extension_name: "",
    }),
  ).toBe("ADLC")
  expect(userInitials({})).toBe("")
  expect(userInitials(null)).toBe("")
})

test("initials are never made from the e-mail or full name", () => {
  expect(
    userInitials({ full_name: "Ana Cruz", email: "ana@example.com" }),
  ).toBe("")
})

test("full name joins the parts, else full_name, else e-mail", () => {
  expect(
    userFullName({
      first_name: "Vic John",
      middle_name: "Oboza",
      last_name: "Salen",
      extension_name: "Jr.",
    }),
  ).toBe("Vic John Oboza Salen Jr.")
  expect(userFullName({ full_name: " Ana Cruz ", email: "a@b.ph" })).toBe(
    "Ana Cruz",
  )
  expect(userFullName({ email: "a@b.ph" })).toBe("a@b.ph")
})
