import i18n from "@/i18n"
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
      return i18n.t("apiErrors.issuance.missingSections", {
        sections: list(body.sections, sectionWords),
      })
    case "missing_resident_fields":
      return i18n.t("apiErrors.issuance.missingResidentFields", {
        fields: list(body.fields, fieldWords),
      })
    case "duplicate_same_day":
      return i18n.t("apiErrors.issuance.duplicateSameDay", {
        reference: String(body.reference_no ?? ""),
      })
    case "archived":
      return i18n.t("apiErrors.issuance.archived")
    case "possible_duplicate":
      return i18n.t("apiErrors.issuance.possibleDuplicate")
    case "tricycle_mismatch":
      return i18n.t("apiErrors.issuance.tricycleMismatch")
    case "tricycle_conflict":
      return i18n.t("apiErrors.issuance.tricycleConflict")
    case "correction_in_progress":
      return i18n.t("apiErrors.issuance.correctionInProgress")
    case "id_already_exists":
      return i18n.t("apiErrors.issuance.idAlreadyExists")
    case "no_earlier_id":
      return i18n.t("apiErrors.issuance.noEarlierId")
    case "id_number_required":
      return i18n.t("apiErrors.issuance.idNumberRequired")
    case "id_number_automatic":
      return i18n.t("apiErrors.issuance.idNumberAutomatic")
    case "id_series_too_long":
      return i18n.t("apiErrors.issuance.idSeriesTooLong")
    case "id_series_exhausted":
      return i18n.t("apiErrors.issuance.idSeriesExhausted")
    case "id_number_in_use":
      return i18n.t("apiErrors.issuance.idNumberInUse")
    case "invalid_valid_until":
      return i18n.t("apiErrors.issuance.invalidValidUntil")
    case "issue_date_too_old":
      return i18n.t("apiErrors.issuance.issueDateTooOld", {
        earliest: String(body.earliest ?? ""),
      })
    case "valid_until_too_long":
      return i18n.t("apiErrors.issuance.validUntilTooLong", {
        latest: String(body.latest ?? ""),
      })
    case "tricycle_has_valid_franchise":
      return i18n.t("apiErrors.issuance.tricycleHasValidFranchise")
    case "id_number_taken":
      return "This ID number is already used by another resident."
    default:
      return message
  }
}
