import type { DocumentField } from "@/components/Issuances/config"
import { calculateAge, formatPaperDate, getDateParts } from "@/lib/issuance-format"

export type PrintRow = { label: string; value: string }

export function getPrintRows(type: string, values: Record<string, string>, currentDate: string): PrintRow[] {
  const rows: PrintRow[] = [
    [type === "Certification (assistance request)" ? "Mr./Ms." : "NAME", values.name ?? ""],
    ["ADDRESS", values.address ?? ""],
  ] as PrintRow[]
  if (type === "Barangay Clearance") rows.push(
    ["AGE", calculateAge(values.birthdate ?? "", currentDate) ? `${calculateAge(values.birthdate ?? "", currentDate)} years old` : ""],
    ["BIRTHDATE", values.birthdate ? formatPaperDate(values.birthdate) : ""],
    ["BIRTHPLACE", values.birthplace ?? ""],
    ["CIVIL STATUS", values.civilStatus ?? ""],
    ["PURPOSE", values.purpose ?? ""],
    ["PURPOSE note", values.purposeNote ?? ""],
    ["REMARKS", values.remarks ?? ""],
    ["c/o", values.referredBy ?? ""],
    ["Valid I.D. Presented", values.validIdPresented ?? ""],
    ["Number", values.idNumber ?? ""],
    ["Place of Issue", values.idPlaceOfIssue ?? ""],
    ["Date of Issue", values.idDateOfIssue ? formatPaperDate(values.idDateOfIssue) : ""],
    ["Paid under OFFICIAL RECEIPT No.", values.officialReceiptNumber ?? ""],
  )
  if (type === "Barangay Franchise Clearance") rows.push(
    ["TRICYCLE ASSOCIATION", values.tricycleAssociation ?? ""],
    ["MAKE", values.make ?? ""],
    ["TYPE OF BODY", values.typeOfBody ?? ""],
    ["MOTOR NO", values.motorNumber ?? ""],
    ["COLOR", values.color ?? ""],
    ["PLATE NUMBER", values.plateNumber ?? ""],
    ["CTC Number", values.ctcNumber ?? ""],
    ["Place of Issue", values.ctcPlaceOfIssue ?? ""],
    ["Date of Issue", values.ctcDateOfIssue ? formatPaperDate(values.ctcDateOfIssue) : ""],
    ["Paid under OFFICIAL RECEIPT No.", values.officialReceiptNumber ?? ""],
  )
  if (type === "Barangay Clearance, Electrical and Water Connection") rows.push(
    ["Service", values.serviceType?.split("||").join(" / ") ?? ""],
    ["TYPE OF CONNECTION", values.connectionType ?? ""],
    ["CLASSIFICATION", values.classification ?? ""],
    ["LOCATION", values.location ?? ""],
    ["CTC Number", values.ctcNumber ?? ""],
    ["Place of Issue", values.ctcPlaceOfIssue ?? ""],
    ["Date of Issue", values.ctcDateOfIssue ? formatPaperDate(values.ctcDateOfIssue) : ""],
    ["Paid under OFFICIAL RECEIPT No.", values.officialReceiptNumber ?? ""],
  )
  if (type === "Certificate of Indigency") rows.push(
    ["AGE", calculateAge(values.birthdate ?? "", currentDate) ? `${calculateAge(values.birthdate ?? "", currentDate)} years old` : values.ageManual ?? ""],
    ["SECTOR :", values.sector?.split("||").join(" / ") ?? ""],
    ["PURPOSE", values.purpose ?? ""],
    ["Addressed to the office of", values.addressedTo ?? ""],
  )
  if (type === "Certification (assistance request)") {
    const dateParts = getDateParts(currentDate)
    rows.push(
      ["Resident of", values.address ?? ""],
      ["For a period of years", values.residencyDuration ?? ""],
      ["Member of the sector", values.sector ?? ""],
      ["Assistance requested", values.assistanceType ?? ""],
      ["For", values.recipientChoice === "His or her" ? `his or her ${values.recipientRelationship ?? ""}` : values.recipientChoice ?? ""],
      ["Under the name of", values.underName ?? ""],
      ["Given this", currentDate ? `${dateParts.day} day of ${dateParts.month}` : ""],
    )
  }
  return rows.map(([label, value]) => ({ label, value: (value ?? "").trim() }))
}

export function getMissingFields(type: string, values: Record<string, string>, fields: DocumentField[]): Array<{ name: string; label: string }> {
  const missing = fields
    .filter((field) => field.required && (!field.showWhen || field.showWhen(values)) && !values[field.name]?.trim())
    .map((field) => ({ name: field.name, label: field.label }))
  if (!values.date?.trim() && !missing.some((field) => field.name === "date")) missing.push({ name: "date", label: "Date on document" })
  if (type === "Barangay Clearance, Electrical and Water Connection" && !values.serviceType?.trim() && !missing.some((field) => field.name === "serviceType")) {
    missing.push({ name: "serviceType", label: "Service" })
  }
  if (type === "Certificate of Indigency" && !values.birthdate?.trim() && !values.ageManual?.trim() && !missing.some((field) => field.name === "ageManual")) {
    missing.push({ name: "ageManual", label: "AGE" })
  }
  return missing
}
