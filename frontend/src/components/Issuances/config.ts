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
}

export const civilStatusOptions = ["Single", "Married", "Legally Separated", "Widow/Widower"]
export const idTypeOptions = ["CTC", "Barangay ID", "VIN", "Passport", "UMID", "School ID", "Driver's License", "Senior Citizen", "Solo Parent", "Postal ID", "PWD ID", "PhilHealth ID", "National ID", "SSS ID", "TIN ID"]
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
]
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
  { name: "name", label: "NAME", required: true },
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
  "Certificate of Indigency",
  "Certification (assistance request)",
]
export const documentSections: Record<string, DocumentSection[]> = {
  "Barangay Clearance": [
    { id: "resident", title: "Resident", description: "Select a resident or enter details manually.", fields: clearanceResident },
    { id: "details", title: "Clearance details", fields: [
      { name: "purpose", label: "PURPOSE", type: "combobox", options: clearancePurposeOptions, required: true },
      { name: "purposeNote", label: "Purpose note", help: "Printed on the line below PURPOSE." },
      { name: "remarks", label: "REMARKS", defaultValue: "NO DEROGATORY RECORD ON FILE" },
      { name: "referredBy", label: "Referred by (c/o)", type: "select", options: ["None"] },
    ] },
    { id: "receipt", title: "Identification & receipt", fields: [
      { name: "validIdPresented", label: "Valid I.D. Presented", type: "select", options: idTypeOptions, required: true },
      ...sharedReceiptFields,
    ] },
  ],
  "Barangay Franchise Clearance": [
    { id: "resident", title: "Resident", fields: [
      { name: "name", label: "NAME", required: true },
      { name: "address", label: "ADDRESS", required: true, help: "Street and purok only. Do not add Mayondon, Los Baños." },
    ] },
    { id: "details", title: "Franchise details", fields: [
      { name: "tricycleAssociation", label: "TRICYCLE ASSOCIATION", type: "combobox", required: true },
      { name: "make", label: "MAKE", required: true },
      { name: "typeOfBody", label: "TYPE OF BODY", required: true, defaultValue: "TRICYCLE" },
      { name: "motorNumber", label: "MOTOR NO", required: true },
      { name: "color", label: "COLOR", required: true },
      { name: "plateNumber", label: "PLATE NUMBER", required: true },
    ] },
    { id: "receipt", title: "CTC & receipt", fields: ctcFields },
  ],
  "Barangay Clearance, Electrical and Water Connection": [
    { id: "services", title: "Connection service", fields: [
      { name: "serviceType", label: "Service", type: "checkboxes", options: ["Electric", "Water"], required: true },
    ] },
    { id: "resident", title: "Resident", fields: [
      { name: "name", label: "NAME", required: true },
      { name: "address", label: "ADDRESS", required: true, help: "Street and purok only. Do not add Mayondon, Los Baños." },
    ] },
    { id: "details", title: "Connection details", fields: [
      { name: "connectionType", label: "TYPE OF CONNECTION", type: "radio", options: ["New", "Reconnection"], required: true },
      { name: "classification", label: "CLASSIFICATION", type: "radio", options: ["Residential", "Commercial"], required: true },
      { name: "location", label: "LOCATION", required: true, defaultValue: "Barangay Mayondon" },
    ] },
    { id: "receipt", title: "CTC & receipt", fields: ctcFields },
  ],
  "Certificate of Indigency": [
    { id: "resident", title: "Resident", fields: [
      { name: "name", label: "NAME", required: true },
      { name: "address", label: "ADDRESS", required: true, help: "Street and purok only. Do not add Mayondon, Los Baños." },
      { name: "age", label: "AGE", type: "readonly" },
      { name: "ageManual", label: "Age (if birthdate is not on record)", type: "number" },
    ] },
    { id: "details", title: "Indigency details", fields: [
      { name: "sector", label: "SECTOR :", type: "multiselect", options: indigencySectorOptions, required: true, maxSelected: 2 },
      { name: "purpose", label: "PURPOSE", type: "combobox", required: true },
      { name: "addressedTo", label: "Addressed to the office of", required: true },
    ] },
  ],
  "Certification (assistance request)": [
    { id: "resident", title: "Resident", fields: [
      { name: "name", label: "Mr./Ms.", required: true },
      { name: "address", label: "Resident of", required: true, help: "Street and purok only. Mayondon, Los Baños, Laguna is pre-printed." },
      { name: "residencyDuration", label: "For a period of years", type: "number", required: true },
    ] },
    { id: "details", title: "Assistance details", fields: [
      { name: "sector", label: "Member of the sector", type: "select", options: indigencySectorOptions, required: true },
      { name: "assistanceType", label: "Assistance requested", type: "radio", options: ["Financial", "Medical", "Burial"], required: true },
      { name: "recipientChoice", label: "For", type: "radio", options: ["Oneself", "His or her"], required: true },
      { name: "recipientRelationship", label: "Relationship", showWhen: (values) => values.recipientChoice === "His or her", required: true },
      { name: "underName", label: "Under the name of", required: true },
    ] },
  ],
}
export const documentFields: Record<string, DocumentField[]> = Object.fromEntries(
  Object.entries(documentSections).map(([type, sections]) => [
    type,
    [{ name: "date", label: "Date", type: "date", required: true, defaultToday: true }, ...sections.flatMap((section) => section.fields)],
  ]),
)
export const sampleIssuances: IssuanceRecord[] = [
  {
    id: "ISS-001",
    resident: "Resident One",
    type: "Barangay Clearance",
    date: "2026-10-23",
    status: "Issued",
    purpose: "Employment Requirement",
    issuedBy: "staff",
    orNumber: "OR-2026-001",
    fields: {},
  },
  {
    id: "ISS-002",
    resident: "Resident Two",
    type: "Franchise Clearance",
    date: "2026-10-22",
    status: "Issued",
    purpose: "Franchise Requirement",
    issuedBy: "staff",
    orNumber: "OR-2026-002",
    fields: {},
  },
  {
    id: "ISS-003",
    resident: "Resident Three",
    type: "Barangay Clearance (Electrical and Water Connection)",
    date: "2026-10-22",
    status: "Voided",
    purpose: "Connection application",
    issuedBy: "admin",
    orNumber: "OR-2026-003",
    voidReason: "Incorrect connection type selected",
    fields: {},
  },
  {
    id: "ISS-004",
    resident: "Resident Four",
    type: "Certificate of Indigency",
    date: "2026-10-21",
    status: "Pending",
    purpose: "Medical assistance",
    fields: {},
  },
]
