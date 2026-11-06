import { readApiError } from "@/lib/residents"

const fieldWords: Record<string, string> = {
  birthdate: "birthdate",
  birth_place: "place of birth",
  civil_status: "civil status",
  sex: "sex",
  house_number: "house number",
  street: "street",
  street_id: "street",
  purok: "purok",
  resident_since: "years living here",
  emergency_contact_name: "emergency contact name",
  emergency_contact_address: "emergency contact address",
  emergency_contact_phone: "emergency contact number",
  photo: "photo",
}

const sectionWords: Record<string, string> = {
  identification: "proof of identity",
  payment: "payment details",
  sectors: "sector",
  utility: "utility details",
  indigency: "indigency details",
  franchise: "tricycle details",
  marginalized: "health condition",
  assistance: "assistance details",
  jobseeker: "jobseeker details",
  barangay_id: "ID card details",
}

const list = (value: unknown, words: Record<string, string>) =>
  (Array.isArray(value) ? value : [])
    .map((item) => words[String(item)] ?? String(item).replace(/_/g, " "))
    .join(", ")

/** Turns an API failure into a sentence a clerk can read. */
export function issuanceErrorMessage(error: unknown): string {
  const { code, message, detail } = readApiError(error)
  const body = (detail ?? {}) as Record<string, unknown>
  switch (code) {
    case "missing_sections":
      return `Please fill in: ${list(body.sections, sectionWords)}.`
    case "missing_resident_fields":
      return `The resident record is missing: ${list(body.fields, fieldWords)}.`
    case "possible_duplicate":
      return "A resident with the same name and birthdate is already on file. Search for them above instead of adding them again."
    case "tricycle_mismatch":
      return "This plate or motor number is already on file with different tricycle details. Check the numbers, make, color and association."
    case "tricycle_conflict":
      return "The plate number and the motor number belong to two different tricycles on file. Check both numbers."
    case "correction_in_progress":
      return "A correction for this document is already open. Finish or discard that draft first."
    case "id_already_exists":
      return "This resident already has a Barangay ID. Choose Renewal or Replacement instead."
    case "no_earlier_id":
      return "This resident has no earlier Barangay ID. Choose New instead."
    case "id_number_required":
      return "Type the Barangay ID number for this card."
    case "id_number_in_use":
      return "This ID number is already used by another resident."
    case "invalid_valid_until":
      return "The “Valid until” date must be after the issue date."
    case "id_number_taken":
      return "This ID number is already used by another resident."
    default:
      return message
  }
}
