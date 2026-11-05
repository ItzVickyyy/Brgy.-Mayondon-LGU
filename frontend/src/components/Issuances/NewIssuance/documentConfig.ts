import { addressedOfficeOptions, clearancePurposeOptions, idTypeOptions, indigencyPurposeOptions, indigencySectorOptions } from "@/components/Issuances/config"

export type DocumentCode =
  | "BARANGAY_CLEARANCE"
  | "FRANCHISE_CLEARANCE"
  | "UTILITY_CLEARANCE"
  | "RESIDENCY"
  | "INDIGENCY"
  | "ASSISTANCE"
  | "MARGINALIZED_SECTOR"
  | "FIRST_TIME_JOBSEEKER"
  | "BARANGAY_ID"

export type DetailFieldType = "text" | "textarea" | "select" | "combobox" | "date" | "number" | "checkbox" | "radio" | "multiselect"
export type DetailGroup = "main" | "identity" | "payment" | "more"

export type DetailFieldConfig = {
  name: string
  label: string
  type: DetailFieldType
  required?: boolean
  default?: string | boolean | string[]
  options?: readonly string[]
  group: DetailGroup
  help?: string
  showWhen?: (values: Record<string, unknown>) => boolean
  maxSelected?: number
}

export type DocumentConfig = {
  code: DocumentCode
  name: string
  shortName: string
  category: "clearance" | "certification" | "id"
  hint: string
  printMode: "overlay" | "full_page"
  validityMonths: number | null
  onePerResident: boolean
  signatoryMode: "preprinted" | "select" | "none"
  signatoryDefault?: string
  fields: DetailFieldConfig[]
  residentNeeds: string[]
}

const purposeOptions = clearancePurposeOptions
const sectorOptions = indigencySectorOptions
const indigencyPurposes = Array.from(new Set([...indigencyPurposeOptions, ...purposeOptions]))
const idOptions = Array.from(new Set(["CTC", ...idTypeOptions]))
const issuePlace = "Los Baños, Laguna"

const identityFields: DetailFieldConfig[] = [
  { name: "idType", label: "Valid ID presented", type: "select", required: true, options: idOptions, group: "identity" },
  { name: "idNumber", label: "ID number", type: "text", required: true, group: "identity" },
  { name: "idPlaceOfIssue", label: "Place of issue", type: "text", required: true, default: issuePlace, group: "identity" },
  { name: "idDateOfIssue", label: "Date of issue", type: "date", required: true, default: "today", group: "identity" },
]
const ctcFields: DetailFieldConfig[] = [
  { name: "idType", label: "ID type", type: "select", required: true, default: "CTC", options: ["CTC"], group: "identity" },
  { name: "idNumber", label: "CTC number", type: "text", required: true, group: "identity" },
  { name: "idPlaceOfIssue", label: "Place of issue", type: "text", required: true, default: issuePlace, group: "identity" },
  { name: "idDateOfIssue", label: "Date of issue", type: "date", required: true, default: "today", group: "identity" },
]
const paymentFields: DetailFieldConfig[] = [
  { name: "officialReceiptNo", label: "Official receipt no.", type: "text", required: true, group: "payment" },
  { name: "isFree", label: "Free of charge", type: "checkbox", default: false, group: "payment" },
]
// The "DOCUMENTARY STAMP TAX PAID" box printed on clearances also shows the payment date and who certified it.
const stampFields: DetailFieldConfig[] = [
  ...paymentFields,
  { name: "dateOfPayment", label: "Date of payment", type: "date", default: "today", group: "payment" },
  { name: "certifiedBy", label: "Certified by (initials)", type: "text", group: "payment", help: "Printed in the stamp box." },
]

export const documentConfig: Record<DocumentCode, DocumentConfig> = {
  BARANGAY_CLEARANCE: {
    code: "BARANGAY_CLEARANCE", name: "Barangay Clearance", shortName: "Barangay Clearance", category: "clearance",
    hint: "Jobs, school, loans", printMode: "overlay", validityMonths: 2, onePerResident: false,
    signatoryMode: "preprinted", residentNeeds: ["birthDate", "birthPlace", "civilStatus", "photo"],
    fields: [
      { name: "purpose", label: "Purpose", type: "select", required: true, options: purposeOptions, group: "main" },
      ...identityFields, ...stampFields,
      { name: "remarks", label: "Remarks", type: "text", default: "NO DEROGATORY RECORD ON FILE", group: "main" },
    ],
  },
  FRANCHISE_CLEARANCE: {
    code: "FRANCHISE_CLEARANCE", name: "Franchise Clearance", shortName: "Franchise Clearance", category: "clearance",
    hint: "Tricycle franchise", printMode: "overlay", validityMonths: null, onePerResident: false,
    signatoryMode: "preprinted", residentNeeds: [], fields: [
      { name: "associationName", label: "Tricycle association", type: "combobox", required: true, group: "main" },
      { name: "make", label: "Make", type: "text", required: true, group: "main" },
      { name: "bodyType", label: "Type of body", type: "text", required: true, default: "TRICYCLE", group: "main" },
      { name: "motorNumber", label: "Motor no.", type: "text", required: true, group: "main" },
      { name: "color", label: "Color", type: "text", required: true, group: "main" },
      { name: "plateNumber", label: "Plate no.", type: "text", required: true, group: "main" },
      ...ctcFields, ...stampFields,
    ],
  },
  UTILITY_CLEARANCE: {
    code: "UTILITY_CLEARANCE", name: "Electrical and Water Clearance", shortName: "Electrical & Water", category: "clearance",
    hint: "Utility connection", printMode: "overlay", validityMonths: null, onePerResident: false,
    signatoryMode: "preprinted", residentNeeds: [], fields: [
      { name: "services", label: "Service", type: "multiselect", required: true, options: ["Electric", "Water"], group: "main" },
      { name: "connectionType", label: "Type of connection", type: "radio", required: true, options: ["New", "Reconnection"], group: "main" },
      { name: "classification", label: "Classification", type: "radio", required: true, options: ["Residential", "Commercial"], group: "main" },
      { name: "location", label: "Location", type: "text", required: true, default: "Barangay Mayondon", group: "main" },
      ...ctcFields, ...stampFields,
    ],
  },
  RESIDENCY: {
    code: "RESIDENCY", name: "Certification of Residency", shortName: "Residency", category: "certification",
    hint: "Proof of residence", printMode: "full_page", validityMonths: null, onePerResident: false,
    signatoryMode: "select", signatoryDefault: "Punong Barangay", residentNeeds: ["residentSince"],
    fields: [
      { name: "purpose", label: "Purpose", type: "combobox", required: true, options: purposeOptions, group: "main" },
      { name: "residentSince", label: "Residing since", type: "text", group: "main" },
      { name: "additionalStatement", label: "Additional statement", type: "textarea", group: "main" },
      ...identityFields.map((field) => ({ ...field, required: false })), ...paymentFields.map((field) => ({ ...field, required: false })),
    ],
  },
  INDIGENCY: {
    code: "INDIGENCY", name: "Certificate of Indigency", shortName: "Indigency", category: "certification",
    hint: "Assistance, fee waiver", printMode: "overlay", validityMonths: null, onePerResident: false,
    signatoryMode: "preprinted", residentNeeds: ["birthDate"],
    fields: [
      { name: "sector", label: "Sector", type: "multiselect", required: true, options: sectorOptions, maxSelected: 2, group: "main" },
      { name: "purpose", label: "Purpose", type: "combobox", required: true, options: indigencyPurposes, group: "main" },
      { name: "addressedToOffice", label: "Office addressed to", type: "combobox", required: true, options: addressedOfficeOptions, group: "main" },
      { name: "requestedBy", label: "Requested by", type: "text", group: "main", help: "Only if someone other than the resident asked for it. Printed after \"Requested by:\"." },
    ],
  },
  ASSISTANCE: {
    code: "ASSISTANCE", name: "Assistance Certification", shortName: "Assistance Certification", category: "certification",
    hint: "Financial, medical, burial", printMode: "overlay", validityMonths: null, onePerResident: false,
    signatoryMode: "select", signatoryDefault: "Barangay Kagawad", residentNeeds: ["residentSince", "sector"],
    fields: [
      { name: "sector", label: "Sector", type: "select", required: true, options: sectorOptions, group: "main" },
      { name: "assistanceType", label: "Assistance requested", type: "select", required: true, options: ["Financial", "Medical", "Burial"], group: "main" },
      { name: "for", label: "For", type: "radio", required: true, options: ["Myself", "Someone else"], group: "main" },
      { name: "relationship", label: "Relationship", type: "text", required: true, group: "main", showWhen: (values) => values.for === "Someone else" },
      { name: "beneficiaryName", label: "Name", type: "text", required: true, group: "main", showWhen: (values) => values.for === "Someone else" },
    ],
  },
  MARGINALIZED_SECTOR: {
    code: "MARGINALIZED_SECTOR", name: "Marginalized Sector (Pagpapatunay)", shortName: "Marginalized Sector", category: "certification",
    hint: "Filipino sector certification", printMode: "full_page", validityMonths: null, onePerResident: false,
    signatoryMode: "select", signatoryDefault: "Barangay Kagawad", residentNeeds: ["sector"],
    fields: [
      { name: "sector", label: "Sector", type: "select", required: true, options: sectorOptions, group: "main" },
      { name: "healthCondition", label: "Health condition", type: "textarea", required: true, group: "main" },
    ],
  },
  FIRST_TIME_JOBSEEKER: {
    code: "FIRST_TIME_JOBSEEKER", name: "First-Time Jobseeker", shortName: "First-Time Jobseeker", category: "certification",
    hint: "First-time job application", printMode: "full_page", validityMonths: 12, onePerResident: true,
    signatoryMode: "select", signatoryDefault: "Punong Barangay", residentNeeds: ["birthDate", "residentSince", "sex", "civilStatus", "photo"],
    fields: [
      { name: "educationalAttainment", label: "Educational attainment", type: "select", required: true, options: ["Elementary", "Junior High School", "Senior High School", "Vocational", "College", "Postgraduate"], group: "main" },
      { name: "course", label: "Course", type: "text", default: "N/A", group: "main" },
      { name: "isJobstartBeneficiary", label: "JobStart beneficiary", type: "select", required: true, options: ["Yes", "No"], group: "main" },
      { name: "parts", label: "Parts to print", type: "multiselect", required: true, default: ["Applicant sheet", "Oath", "Certification"], options: ["Applicant sheet", "Oath", "Certification"], group: "main" },
      { name: "witnessOfficialId", label: "Witness", type: "select", required: true, options: ["Barangay Clerk", "Administrative Assistant", "SK Chairperson"], group: "main" },
    ],
  },
  BARANGAY_ID: {
    code: "BARANGAY_ID", name: "Barangay ID", shortName: "Barangay ID", category: "id",
    hint: "New ID, renewal, replacement", printMode: "overlay", validityMonths: null, onePerResident: false,
    signatoryMode: "none", residentNeeds: ["birthDate", "birthPlace", "sex", "civilStatus", "photo", "emergencyContact"],
    fields: [
      { name: "transactionType", label: "Transaction", type: "select", required: true, options: ["New", "Renewal", "Replacement"], group: "main" },
      { name: "idNumber", label: "Barangay ID number", type: "text", group: "main", help: "Assigned number shown read-only when available." },
      { name: "validUntil", label: "Valid until", type: "date", required: true, default: "oneYearAfterIssue", group: "main" },
    ],
  },
}

export const documentConfigList = Object.values(documentConfig)
