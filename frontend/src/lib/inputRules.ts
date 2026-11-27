import type { ChangeEvent, KeyboardEvent } from "react"

/**
 * One place for "what may be typed in this box". Each rule has a cleaner (used
 * on every change, so a paste is cleaned too), a single-character test (used on
 * key press, so a wrong key never appears and the caret does not jump) and a
 * length limit.
 */
export type InputRule = "digits" | "year" | "phone" | "name" | "code"

const LIMITS: Record<InputRule, number> = {
  digits: 9,
  year: 4,
  phone: 16,
  name: 100,
  code: 40,
}

const CHAR_TESTS: Record<InputRule, RegExp> = {
  digits: /^\d$/,
  year: /^\d$/,
  phone: /^[\d+\-()\s]$/,
  // Letters of any language (Ñ, accents), spaces and the marks in real names.
  name: /^[\p{L}\p{M}\s.'’,-]$/u,
  // Plate, motor and ID numbers: letters, digits, space, hyphen, slash, dot.
  code: /^[\p{L}\d\s\-/.]$/u,
}

export function sanitize(rule: InputRule, value: string, max?: number): string {
  const limit = max ?? LIMITS[rule]
  let cleaned: string
  switch (rule) {
    case "digits":
    case "year":
      cleaned = value.replace(/\D/g, "")
      break
    case "phone":
      // A plus sign is only allowed as the first character.
      cleaned = value
        .replace(/[^\d+\-()\s]/g, "")
        .replace(/(?!^)\+/g, "")
        .replace(/\s{2,}/g, " ")
      break
    case "name":
      cleaned = value
        .replace(/[^\p{L}\p{M}\s.'’,-]/gu, "")
        .replace(/\s{2,}/g, " ")
      break
    case "code":
      cleaned = value.replace(/[^\p{L}\d\s\-/.]/gu, "").replace(/\s{2,}/g, " ")
      break
  }
  return cleaned.slice(0, limit)
}

/** True when a single typed character is allowed by the rule. */
export function allowsChar(rule: InputRule, character: string): boolean {
  return CHAR_TESTS[rule].test(character)
}

type RuleProps = {
  inputMode: "numeric" | "tel" | "text"
  autoComplete: "off" | "tel"
  maxLength: number
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Spread onto an `<input>` or `<Input>`: `{...ruleProps("digits", (v) => set(v))}`.
 * The setter receives the cleaned text, never the raw event, and works with
 * React Hook Form's `field.onChange` as well.
 */
export function ruleProps(
  rule: InputRule,
  setValue: (next: string) => void,
  max?: number,
): RuleProps {
  return {
    inputMode:
      rule === "digits" || rule === "year"
        ? "numeric"
        : rule === "phone"
          ? "tel"
          : "text",
    autoComplete: rule === "phone" ? "tel" : "off",
    maxLength: max ?? LIMITS[rule],
    onKeyDown: (event) => {
      // Shortcuts (Ctrl+V, Ctrl+A), Enter, Tab, arrows and Backspace pass.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.length !== 1) return
      if (!allowsChar(rule, event.key)) event.preventDefault()
    },
    onChange: (event) => setValue(sanitize(rule, event.target.value, max)),
  }
}

/**
 * A Philippine mobile or landline number: 7 to 13 digits once spaces are removed.
 * A mobile number is held to its real length: one that starts 09 has exactly 11
 * digits and one that starts 639 (+63 9...) exactly 12. Keep equal to `phone_ok`
 * in `backend/app/core/resident_validation.py`.
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.startsWith("09")) return digits.length === 11
  if (digits.startsWith("639")) return digits.length === 12
  return digits.length >= 7 && digits.length <= 13
}

/** A name must start with a letter. Empty is allowed (the caller checks required). */
export function isValidName(value: string): boolean {
  const text = value.trim()
  if (!text) return true
  return /^\p{L}[\p{L}\p{M}\s.'’,-]*$/u.test(text.normalize("NFC"))
}

/** A birthdate from 1 January 1900 to `latest` (YYYY-MM-DD). Empty is allowed. */
export function isValidBirthdate(value: string, latest: string): boolean {
  if (!value) return true
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "1900-01-01" &&
    value <= latest
  )
}

/** A four-digit year from 1900 to this year. Empty is allowed (the box is optional). */
export function isValidYear(value: string): boolean {
  if (!value) return true
  if (!/^\d{4}$/.test(value)) return false
  const year = Number(value)
  return year >= 1900 && year <= new Date().getFullYear()
}

/** A purok is a whole number from 1 to 99. Empty is allowed. */
export function isValidPurok(value: string): boolean {
  if (!value) return true
  if (!/^\d{1,2}$/.test(value)) return false
  const purok = Number(value)
  return purok >= 1 && purok <= 99
}

/** Number box that also takes a minus sign and a decimal point (print shift). */
export function blockNumberBoxJunk(event: KeyboardEvent<HTMLInputElement>) {
  if (["e", "E", "+"].includes(event.key)) event.preventDefault()
}
