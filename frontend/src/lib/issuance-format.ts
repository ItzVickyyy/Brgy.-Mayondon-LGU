export function calculateAge(birthdate: string, asOfDate: string): string {
  if (!birthdate || !asOfDate) return ""
  const birth = new Date(`${birthdate}T00:00:00`)
  const asOf = new Date(`${asOfDate}T00:00:00`)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime()) || birth > asOf) return ""
  let age = asOf.getFullYear() - birth.getFullYear()
  const monthDifference = asOf.getMonth() - birth.getMonth()
  const birthdayNotReached =
    monthDifference < 0 ||
    (monthDifference === 0 && asOf.getDate() < birth.getDate())
  if (birthdayNotReached) age -= 1
  return String(age)
}

export function formatPrintedName(
  firstName: string,
  middleName: string,
  lastName: string,
  documentType: string,
): string {
  const first = firstName.trim()
  const middle = middleName.trim()
  const last = lastName.trim()
  if (documentType === "Barangay Clearance") {
    return [last ? `${last.toUpperCase()},` : "", first, middle].filter(Boolean).join(" ").toUpperCase()
  }
  const middleInitial = middle ? `${middle.replace(/\./g, "").charAt(0).toUpperCase()}.` : ""
  return [first, middleInitial, last].filter(Boolean).join(" ").toUpperCase()
}

export function formatPaperDate(value: string): string {
  if (!value) return ""
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

export function getDateParts(value: string): { day: string; month: string } {
  if (!value) return { day: "", month: "" }
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return { day: "", month: "" }
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString("en-US", { month: "long" }),
  }
}

export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return 0
  return new Date(year, month, 0).getDate()
}

export function buildIsoDate(year: string, month: string, day: string): string {
  if (!/^\\d{4}$/.test(year) || !/^\\d{1,2}$/.test(month) || !/^\\d{1,2}$/.test(day)) return ""
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  if (numericYear < 1 || numericMonth < 1 || numericMonth > 12) return ""
  if (numericDay < 1 || numericDay > daysInMonth(numericYear, numericMonth)) return ""
  return `${year}-${String(numericMonth).padStart(2, "0")}-${String(numericDay).padStart(2, "0")}`
}

export function splitIsoDate(value: string): { year: string; month: string; day: string } {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value)
  if (!match || buildIsoDate(match[1], match[2], match[3]) !== value) {
    return { year: "", month: "", day: "" }
  }
  return { year: match[1], month: match[2], day: match[3] }
}
