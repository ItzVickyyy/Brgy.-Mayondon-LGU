// Shown labels for the New Issuance form. `documentConfig.ts` and `schemas.ts`
// keep their English text because the values and field names inside them are
// what the API stores and what the print code reads. These helpers only change
// what is shown. Text with no entry here is shown exactly as it is stored.
import type { ParseKeys, TFunction } from "i18next"

import type { DocumentCode } from "@/components/Issuances/NewIssuance/documentConfig"

function lookup(
  keys: Record<string, ParseKeys>,
  text: string,
  t: TFunction,
): string {
  const key = keys[text]
  return key ? t(key) : text
}

export const documentName = (code: DocumentCode, t: TFunction) =>
  t(`issuances.new.documents.${code}.name`)

export const documentShortName = (code: DocumentCode, t: TFunction) =>
  t(`issuances.new.documents.${code}.short`)

export const documentHint = (code: DocumentCode, t: TFunction) =>
  t(`issuances.new.documents.${code}.hint`)

// English field label (as written in documentConfig.ts) -> translation key.
const fieldLabelKeys = {
  "Valid ID presented": "issuances.new.fieldLabels.validId",
  "ID number": "issuances.new.fieldLabels.idNumber",
  "Place of issue": "issuances.new.fieldLabels.placeOfIssue",
  "Date of issue": "issuances.new.fieldLabels.dateOfIssue",
  "ID type": "issuances.new.fieldLabels.idType",
  "CTC number": "issuances.new.fieldLabels.ctcNumber",
  "Official receipt no.": "issuances.new.fieldLabels.receiptNo",
  "Free of charge": "issuances.new.fieldLabels.freeOfCharge",
  "Date of payment": "issuances.new.fieldLabels.dateOfPayment",
  "Certified by (initials)": "issuances.new.fieldLabels.certifiedBy",
  Purpose: "issuances.new.fieldLabels.purpose",
  Remarks: "issuances.new.fieldLabels.remarks",
  "Tricycle association": "issuances.new.fieldLabels.association",
  Make: "issuances.new.fieldLabels.make",
  "Type of body": "issuances.new.fieldLabels.bodyType",
  "Motor no.": "issuances.new.fieldLabels.motorNo",
  Color: "issuances.new.fieldLabels.color",
  "Plate no.": "issuances.new.fieldLabels.plateNo",
  Service: "issuances.new.fieldLabels.service",
  "Type of connection": "issuances.new.fieldLabels.connectionType",
  Classification: "issuances.new.fieldLabels.classification",
  Location: "issuances.new.fieldLabels.location",
  "Residing since": "issuances.new.fieldLabels.residingSince",
  "Additional statement": "issuances.new.fieldLabels.additionalStatement",
  Sector: "issuances.new.fieldLabels.sector",
  "Office addressed to": "issuances.new.fieldLabels.officeAddressedTo",
  "Requested by": "issuances.new.fieldLabels.requestedBy",
  "Assistance requested": "issuances.new.fieldLabels.assistanceRequested",
  For: "issuances.new.fieldLabels.for",
  Relationship: "issuances.new.fieldLabels.relationship",
  Name: "issuances.new.fieldLabels.name",
  "Health condition": "issuances.new.fieldLabels.healthCondition",
  "Educational attainment": "issuances.new.fieldLabels.educationalAttainment",
  Course: "issuances.new.fieldLabels.course",
  "JobStart beneficiary": "issuances.new.fieldLabels.jobstart",
  "Parts to print": "issuances.new.fieldLabels.partsToPrint",
  Witness: "issuances.new.fieldLabels.witness",
  Transaction: "issuances.new.fieldLabels.transaction",
  "Barangay ID number": "issuances.new.fieldLabels.barangayIdNumber",
  "Valid until": "issuances.new.fieldLabels.validUntil",
} as const satisfies Record<string, ParseKeys>

export const fieldLabel = (label: string, t: TFunction) =>
  lookup(fieldLabelKeys, label, t)

const fieldHelpKeys = {
  "Printed in the stamp box.": "issuances.new.fieldHelp.stampBox",
  'Only if someone other than the resident asked for it. Printed after "Requested by:".':
    "issuances.new.fieldHelp.requestedBy",
  "Type the number printed on the card. Leave it as shown to keep the resident's current number.":
    "issuances.new.fieldHelp.barangayIdNumber",
} as const satisfies Record<string, ParseKeys>

export const fieldHelp = (help: string, t: TFunction) =>
  lookup(fieldHelpKeys, help, t)

// Only these fields have fixed English choices that belong to this form. Other
// choices (purposes, ID types, sectors, offices, officials) are lookup text and
// are shown as stored, so a lookup item that happens to be called "Medical" is
// never renamed by accident.
const optionKeys = {
  Electric: "issuances.new.options.Electric",
  Water: "issuances.new.options.Water",
  New: "issuances.new.options.New",
  Reconnection: "issuances.new.options.Reconnection",
  Residential: "issuances.new.options.Residential",
  Commercial: "issuances.new.options.Commercial",
  Myself: "issuances.new.options.Myself",
  "Someone else": "issuances.new.options.Someone else",
  Financial: "issuances.new.options.Financial",
  Medical: "issuances.new.options.Medical",
  Burial: "issuances.new.options.Burial",
  Yes: "issuances.new.options.Yes",
  No: "issuances.new.options.No",
  Renewal: "issuances.new.options.Renewal",
  Replacement: "issuances.new.options.Replacement",
  "Applicant sheet": "issuances.new.options.Applicant sheet",
  Oath: "issuances.new.options.Oath",
  Certification: "issuances.new.options.Certification",
  Elementary: "issuances.new.options.Elementary",
  "Junior High School": "issuances.new.options.Junior High School",
  "Senior High School": "issuances.new.options.Senior High School",
  Vocational: "issuances.new.options.Vocational",
  College: "issuances.new.options.College",
  Postgraduate: "issuances.new.options.Postgraduate",
} as const satisfies Record<string, ParseKeys>

const translatedOptionFields = new Set([
  "services",
  "connectionType",
  "classification",
  "for",
  "assistanceType",
  "isJobstartBeneficiary",
  "transactionType",
  "parts",
  "educationalAttainment",
])

export function fieldOptionLabel(
  fieldName: string,
  option: string,
  t: TFunction,
) {
  return translatedOptionFields.has(fieldName)
    ? lookup(optionKeys, option, t)
    : option
}

// Validation messages written in schemas.ts. Unknown messages are shown as is.
const validationKeys = {
  "This field is required.": "issuances.new.validation.required",
  "Use a valid ISO date (YYYY-MM-DD).": "issuances.new.validation.isoDate",
  "Official receipt number is required unless free of charge.":
    "issuances.new.validation.receiptRequired",
  "Name is required when assistance is for someone else.":
    "issuances.new.validation.beneficiaryName",
  "Relationship is required when assistance is for someone else.":
    "issuances.new.validation.beneficiaryRelationship",
  "Details must match the selected document type.":
    "issuances.new.validation.typeMismatch",
  "Purpose is required.": "issuances.new.validation.purposeRequired",
  "Choose a sector.": "issuances.new.validation.chooseSector",
  "Choose no more than two sectors.": "issuances.new.validation.maxTwoSectors",
  "Choose exactly one sector.": "issuances.new.validation.exactlyOneSector",
  "Choose a signatory.": "issuances.new.validation.chooseSignatory",
  "Proof of identity is required.": "issuances.new.validation.identityRequired",
  "Payment details are required.": "issuances.new.validation.paymentRequired",
} as const satisfies Record<string, ParseKeys>

export const validationMessage = (message: string, t: TFunction) =>
  lookup(validationKeys, message, t)

// Messages from lib/photo-upload.ts.
const photoUploadKeys = {
  "Please choose a JPG, PNG or WebP picture.":
    "issuances.new.photoCapture.errors.fileType",
  "This picture could not be opened. Please choose a JPG, PNG or WebP photo.":
    "issuances.new.photoCapture.errors.cannotOpen",
  "This picture is too large. Please choose one under 15 MB.":
    "issuances.new.photoCapture.errors.tooLarge",
} as const satisfies Record<string, ParseKeys>

export const photoUploadMessage = (message: string, t: TFunction) =>
  lookup(photoUploadKeys, message, t)
