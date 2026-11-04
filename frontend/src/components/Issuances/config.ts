export type FieldType = "text" | "date" | "select" | "combobox" | "radio" | "checkboxes" | "multiselect" | "number" | "readonly" | "textarea"
export type DocumentField = {
  name: string
  label: string
  type?: FieldType
  options?: string[]
  required?: boolean
  defaultValue?: string
  help?: string
  showWhen?: (values: Record<string, string>) => boolean
  maxSelected?: number
  span?: 1 | 2 | 3
  defaultToday?: boolean
  fullWidth?: boolean
  advanced?: boolean
}
export type DocumentSection = { id: string; title: string; description?: string; fields: DocumentField[] }
export type IssuanceRecord = {
  id: string
  resident: string
  type: string
  date: string
  status: "Issued" | "Pending" | "Voided"
  purpose?: string
  validUntil?: string
  voidReason?: string
  correctionReason?: string
  issuedBy?: string
  orNumber?: string
  fields: Record<string, string>
  witness?: string
  signedBy?: string
  sensitive?: boolean
}

export const civilStatusOptions = ["Single", "Married", "Legally Separated", "Widow/Widower"]
export const idTypeOptions = ["CTC", "Barangay ID", "VIN", "Passport", "UMID", "School ID", "Driver's License", "Senior Citizen", "Solo Parent", "Postal ID", "PWD ID", "PhilHealth ID", "PRC ID", "National ID", "SSS ID", "TIN ID"]
export const clearancePurposeOptions = [
  "Employment Requirement",
  "Student Permit Requirement",
  "Proof of Residency only",
  "SIDECAR Loan Application Requirement",
  "Loan Application Requirement",
  "House Loan Application Requirement",
  "Franchise Requirement",
  "Internet Connection Application Requirement",
  "Bank Requirement (Opening Bank Account)",
  "Driver's License Requirement",
  "Overseas Employment Requirement",
  "E-BIKE Loan Application Requirement",
  "Permit to Carry Firearms License",
  "E-BIKE Franchise Requirement",
  "Employment Requirement/First Time Jobseeker",
  "School/OJT Requirement",
  "Motor Loan Application Requirement",
  "Electric Installation Requirements",
  "Senior Citizen Requirement",
  "Application for Service/Special Permit",
  "POSTAL ID",
  "OJT Requirement",
  "PESO Requirement",
  "Firearms License",
  "Franchise Requirement (Special Permit)",
  "Car Loan Application Requirement",
  "Marriage Application Requirement",
  "E-Bike Application",
  "LTOPF Registration",
  "PAARU",
]
/** Purposes the office types on the Certificate of Indigency (from the current Clearance Issuing sheet). */
export const indigencyPurposeOptions = [
  "Scholarship Requirement",
  "Medical Assistance",
  "Financial/Medical Assistance",
  "Financial/Burial Assistance",
  "Delayed Registration of Birth",
  "PESO Requirement",
  "PAO Requirement",
  "BIR Tax Exemption for Scholarship Requirement",
  "Work Requirement",
]
/** Offices the Certificate of Indigency is usually addressed to. Names of elected officials are not listed because they change; staff type them in the box. */
export const addressedOfficeOptions = [
  "CHED",
  "DOH",
  "DSWD - Region IV-A",
  "PAO",
  "RHU-II",
  "Mental Hospital - Mandaluyong City",
  "Laguna District Bay Laguna",
]
export const purposeNoteOptions = ["NOT APPLICABLE FOR LOAN PURPOSES"]
export const indigencySectorOptions = [
  "Urban Poor",
  "Small Farmers and Rural Workers",
  "Fisherfolk",
  "Workers in the Informal Economy",
  "Person with Disabilities (PWD)",
  "Solo Parents",
  "Senior Citizens",
  "Barangay-based Volunteer Workers",
  "Government Employee",
  "STUDENT",
  "other marginalized sector",
]

const sharedReceiptFields: DocumentField[] = [
  { name: "idNumber", label: "Number", required: true },
  { name: "idPlaceOfIssue", label: "Place of Issue", required: true, defaultValue: "Los Baños, Laguna" },
  { name: "idDateOfIssue", label: "Date of Issue", type: "date", required: true },
  { name: "officialReceiptNumber", label: "Paid under OFFICIAL RECEIPT No.", required: true, help: "Enter the receipt number, or FOC if free of charge." },
]
const ctcFields: DocumentField[] = [
  { name: "ctcNumber", label: "CTC Number", required: true },
  { name: "ctcPlaceOfIssue", label: "Place of Issue", required: true, defaultValue: "Los Baños, Laguna" },
  { name: "ctcDateOfIssue", label: "Date of Issue", type: "date", required: true },
  { name: "officialReceiptNumber", label: "Paid under OFFICIAL RECEIPT No.", required: true, help: "Enter the receipt number, or FOC if free of charge." },
]
const clearanceResident: DocumentField[] = [
  { name: "firstName", label: "Given names" },
  { name: "middleName", label: "Middle name" },
  { name: "lastName", label: "Surname" },
  { name: "name", label: "Name as printed", required: true },
  { name: "address", label: "ADDRESS", required: true, help: "Street and purok only. Do not add Mayondon, Los Baños." },
  { name: "birthdate", label: "BIRTHDATE", type: "date", required: true },
  { name: "age", label: "AGE", type: "readonly" },
  { name: "birthplace", label: "BIRTHPLACE", required: true },
  { name: "civilStatus", label: "CIVIL STATUS", type: "select", options: civilStatusOptions, required: true },
]
export const documentTypes = [
  "Barangay Clearance",
  "Barangay Franchise Clearance",
  "Barangay Clearance, Electrical and Water Connection",
  "Certification of Residency",
  "Certificate of Indigency",
  "Certification (assistance request)",
  "Marginalized Sector Certification (Pagpapatunay)",
  "First-Time Jobseeker Certification",
] as const

export type DocumentType = (typeof documentTypes)[number]
export type DocumentGroup = "Clearances" | "Certifications"
export type DocumentMeta = {
  shortName: string
  group: DocumentGroup
  language: "en" | "fil"
  paper: { size: "letter" | "legal" | "a4"; orientation: "portrait" }
  printMode: "values-only" | "full-page"
  validity: { months?: number; years?: number } | null
  signatory: "preprinted" | "select"
  onePerResident: boolean
  hasReceiptStamp: boolean
  hint: string
}

export const documentCardInfo: Record<string, { name: string; hint: string }> = {
  "Barangay Clearance": { name: "Barangay Clearance", hint: "Jobs, school, loans" },
  "Barangay Franchise Clearance": { name: "Franchise Clearance", hint: "Tricycle franchise" },
  "Barangay Clearance, Electrical and Water Connection": { name: "Electrical & Water", hint: "Utility connection" },
  "Certification of Residency": { name: "Residency", hint: "Proof of residence" },
  "Certificate of Indigency": { name: "Certificate of Indigency", hint: "Assistance, fee waiver" },
  "Certification (assistance request)": { name: "Assistance Certification", hint: "Financial, medical, burial" },
  "Marginalized Sector Certification (Pagpapatunay)": { name: "Marginalized Sector", hint: "Filipino sector certification" },
  "First-Time Jobseeker Certification": { name: "First-Time Jobseeker", hint: "First-time job application" },
}

export const documentMeta: Record<string, DocumentMeta> = {
  "Barangay Clearance": {
    shortName: "Barangay Clearance",
    group: "Clearances",
    language: "en",
    paper: { size: "letter", orientation: "portrait" },
    printMode: "values-only",
    validity: { months: 2 },
    signatory: "preprinted",
    onePerResident: false,
    hasReceiptStamp: true,
    hint: "Jobs, school, loans",
  },
  "Barangay Franchise Clearance": {
    shortName: "Franchise Clearance",
    group: "Clearances",
    language: "en",
    paper: { size: "letter", orientation: "portrait" },
    printMode: "values-only",
    validity: null,
    signatory: "preprinted",
    onePerResident: false,
    hasReceiptStamp: true,
    hint: "Tricycle franchise",
  },
  "Barangay Clearance, Electrical and Water Connection": {
    shortName: "Electrical & Water",
    group: "Clearances",
    language: "en",
    paper: { size: "letter", orientation: "portrait" },
    printMode: "values-only",
    validity: null,
    signatory: "preprinted",
    onePerResident: false,
    hasReceiptStamp: true,
    hint: "Utility connection",
  },
  "Certification of Residency": {
    shortName: "Residency",
    group: "Certifications",
    language: "en",
    paper: { size: "letter", orientation: "portrait" },
    printMode: "full-page",
    validity: null,
    signatory: "select",
    onePerResident: false,
    hasReceiptStamp: false,
    hint: "Proof of residence",
  },
  "Certificate of Indigency": {
    shortName: "Certificate of Indigency",
    group: "Certifications",
    language: "en",
    paper: { size: "letter", orientation: "portrait" },
    printMode: "values-only",
    validity: null,
    signatory: "preprinted",
    onePerResident: false,
    hasReceiptStamp: false,
    hint: "Assistance, fee waiver",
  },
  "Certification (assistance request)": {
    shortName: "Assistance Certification",
    group: "Certifications",
    language: "en",
    paper: { size: "letter", orientation: "portrait" },
    printMode: "values-only",
    validity: null,
    signatory: "preprinted",
    onePerResident: false,
    hasReceiptStamp: false,
    hint: "Financial, medical, burial",
  },
  "Marginalized Sector Certification (Pagpapatunay)": {
    shortName: "Marginalized Sector",
    group: "Certifications",
    language: "fil",
    paper: { size: "letter", orientation: "portrait" },
    printMode: "full-page",
    validity: null,
    signatory: "select",
    onePerResident: false,
    hasReceiptStamp: false,
    hint: "Filipino sector certification",
  },
  "First-Time Jobseeker Certification": {
    shortName: "First-Time Jobseeker",
    group: "Certifications",
    language: "en",
    paper: { size: "legal", orientation: "portrait" },
    printMode: "full-page",
    validity: { years: 1 },
    signatory: "select",
    onePerResident: true,
    hasReceiptStamp: false,
    hint: "First-time job application",
  },
}

export const historyDocumentTypes = [
  "Barangay ID",
  "Barangay Clearance",
  "Franchise Clearance",
  "Barangay Clearance (Electrical and Water Connection)",
  "Certification of Residency",
  "Certificate of Indigency",
  "Certification (assistance request)",
  "Marginalized Sector Certification (Pagpapatunay)",
  "First-Time Jobseeker Certification",
]

const documentTypeAliases: Record<string, string> = {
  "barangay id": "Barangay ID",
  "barangay clearance": "Barangay Clearance",
  "franchise clearance": "Barangay Franchise Clearance",
  "barangay franchise clearance": "Barangay Franchise Clearance",
  "barangay clearance (electrical and water connection)": "Barangay Clearance, Electrical and Water Connection",
  "barangay clearance, electrical and water connection": "Barangay Clearance, Electrical and Water Connection",
  "electrical & water": "Barangay Clearance, Electrical and Water Connection",
  "certificate of indigency": "Certificate of Indigency",
  damayan: "Certificate of Indigency",
  "assistance request certification": "Certification (assistance request)",
  "assistance certification": "Certification (assistance request)",
  "certification (assistance request)": "Certification (assistance request)",
  "residency certification": "Certification of Residency",
  "certification of residency": "Certification of Residency",
  "marginalized sector": "Marginalized Sector Certification (Pagpapatunay)",
  "marginalized sector certification": "Marginalized Sector Certification (Pagpapatunay)",
  "marginalized sector certification (pagpapatunay)": "Marginalized Sector Certification (Pagpapatunay)",
  pagpapatunay: "Marginalized Sector Certification (Pagpapatunay)",
  "first-time jobseekers certification": "First-Time Jobseeker Certification",
  "first-time jobseeker certification": "First-Time Jobseeker Certification",
}

export function normalizeDocumentType(value: string): string {
  const normalized = value.trim().toLowerCase()
  return documentTypeAliases[normalized] ?? normalized
}

export const documentSections: Record<string, DocumentSection[]> = {
  "Barangay Clearance": [
    { id: "resident", title: "Resident", description: "Select a resident or enter details manually.", fields: clearanceResident },
    { id: "details", title: "Clearance details", fields: [
      { name: "purpose", label: "PURPOSE", type: "combobox", options: clearancePurposeOptions, required: true },
      { name: "purposeNote", label: "Purpose note", help: "Printed on the line below PURPOSE.", advanced: true },
      { name: "remarks", label: "REMARKS", defaultValue: "NO DEROGATORY RECORD ON FILE", advanced: true },
      { name: "referredBy", label: "Referred by (c/o)", type: "select", options: [], advanced: true },
    ] },
    { id: "receipt", title: "Identification & receipt", fields: [
      { name: "validIdPresented", label: "Valid I.D. Presented", type: "select", options: idTypeOptions, required: true },
      ...sharedReceiptFields,
    ] },
  ],
  "Barangay Franchise Clearance": [
    { id: "resident", title: "Resident", fields: [
      { name: "firstName", label: "Given names" },
      { name: "middleName", label: "Middle name" },
      { name: "lastName", label: "Surname" },
      { name: "name", label: "Name as printed", required: true },
      { name: "address", label: "ADDRESS", required: true, help: "Street and purok only. Do not add Mayondon, Los Baños." },
    ] },
    { id: "details", title: "Franchise details", fields: [
      { name: "tricycleAssociation", label: "TRICYCLE ASSOCIATION", type: "combobox", required: true, span: 3 },
      { name: "make", label: "MAKE", required: true },
      { name: "typeOfBody", label: "TYPE OF BODY", required: true, defaultValue: "TRICYCLE" },
      { name: "motorNumber", label: "MOTOR NO", required: true },
      { name: "color", label: "COLOR", required: true },
      { name: "plateNumber", label: "PLATE NUMBER", required: true },
    ] },
    { id: "receipt", title: "CTC & receipt", fields: ctcFields },
  ],
  "Barangay Clearance, Electrical and Water Connection": [
    { id: "resident", title: "Resident", fields: [
      { name: "firstName", label: "Given names" },
      { name: "middleName", label: "Middle name" },
      { name: "lastName", label: "Surname" },
      { name: "name", label: "Name as printed", required: true },
      { name: "address", label: "ADDRESS", required: true, help: "Street and purok only. Do not add Mayondon, Los Baños." },
    ] },
    { id: "details", title: "Connection details", fields: [
      { name: "serviceType", label: "Service", type: "checkboxes", options: ["Electric", "Water"], required: true, fullWidth: true },
      { name: "connectionType", label: "TYPE OF CONNECTION", type: "radio", options: ["New", "Reconnection"], required: true },
      { name: "classification", label: "CLASSIFICATION", type: "radio", options: ["Residential", "Commercial"], required: true },
      { name: "location", label: "LOCATION", required: true, defaultValue: "Barangay Mayondon" },
    ] },
    { id: "receipt", title: "CTC & receipt", fields: ctcFields },
  ],
  "Certificate of Indigency": [
    { id: "resident", title: "Resident", fields: [
      { name: "firstName", label: "Given names" },
      { name: "middleName", label: "Middle name" },
      { name: "lastName", label: "Surname" },
      { name: "name", label: "Name as printed", required: true },
      { name: "address", label: "ADDRESS", required: true, help: "Street and purok only. Do not add Mayondon, Los Baños." },
      { name: "age", label: "AGE", type: "readonly" },
      { name: "ageManual", label: "Age (if birthdate is not on record)", type: "number", showWhen: (values) => !values.birthdate },
    ] },
    { id: "details", title: "Indigency details", fields: [
      { name: "sector", label: "SECTOR :", type: "multiselect", options: indigencySectorOptions, required: true, maxSelected: 2 },
      { name: "purpose", label: "PURPOSE", type: "combobox", required: true },
      { name: "addressedTo", label: "Office", required: true },
    ] },
  ],
  "Certification (assistance request)": [
    { id: "resident", title: "Resident", fields: [
      { name: "firstName", label: "Given names" },
      { name: "middleName", label: "Middle name" },
      { name: "lastName", label: "Surname" },
      { name: "name", label: "Mr./Ms.", required: true },
      { name: "address", label: "Resident of", required: true, help: "Street and purok only. Mayondon, Los Baños, Laguna is pre-printed." },
      { name: "residencyDuration", label: "For a period of years", type: "number", required: true },
    ] },
    { id: "details", title: "Assistance details", fields: [
      { name: "sector", label: "Member of the sector", type: "select", options: indigencySectorOptions, required: true },
      { name: "assistanceType", label: "Assistance requested", type: "radio", options: ["Financial", "Medical", "Burial"], required: true },
      { name: "recipientChoice", label: "For", type: "radio", options: ["Oneself", "His or her"], required: true },
      { name: "recipientRelationship", label: "Relationship", showWhen: (values) => values.recipientChoice === "His or her", required: true },
      { name: "underName", label: "Under the name of", required: true, showWhen: (values) => values.recipientChoice !== "Oneself" },
    ] },
  ],
}
export const documentFields: Record<string, DocumentField[]> = Object.fromEntries(
  documentTypes.map((type) => [
    type,
    [
      { name: "date", label: "Date", type: "date", required: true, defaultToday: true },
      ...(documentSections[type] ?? []).flatMap((section) => section.fields),
    ],
  ]),
)
export const sampleIssuances: IssuanceRecord[] = []
