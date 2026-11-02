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
  "Certificate of Indigency",
  "Certification (assistance request)",
]
export const historyDocumentTypes = [
  "Barangay ID",
  "Barangay Clearance",
  "Franchise Clearance",
  "Barangay Clearance (Electrical and Water Connection)",
  "Certificate of Indigency",
  "First-Time Jobseekers Certification",
  "Assistance Request Certification",
  "Damayan",
]
export const documentSections: Record<string, DocumentSection[]> = {
  "Barangay Clearance": [
    { id: "resident", title: "Resident", description: "Select a resident or enter details manually.", fields: clearanceResident },
    { id: "details", title: "Clearance details", fields: [
      { name: "purpose", label: "PURPOSE", type: "combobox", options: clearancePurposeOptions, required: true },
      { name: "purposeNote", label: "Purpose note", help: "Printed on the line below PURPOSE." },
      { name: "remarks", label: "REMARKS", defaultValue: "NO DEROGATORY RECORD ON FILE" },
      { name: "referredBy", label: "Referred by (c/o)", type: "select", options: ["None", "c/o Kap. Barangay Captain", "c/o Kag. Barangay Kagawad 1"] },
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
      { name: "firstName", label: "Given names" },
      { name: "middleName", label: "Middle name" },
      { name: "lastName", label: "Surname" },
      { name: "name", label: "Name as printed", required: true },
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
export const provisionalDocumentFields: Record<string, DocumentField[]> = {
  "Barangay ID": [
    {
      name: "idAction",
      label: "ID Transaction",
      type: "select",
      options: ["New ID", "Renewal", "Replacement"],
    },
    { name: "name", label: "Full Name" },
    { name: "address", label: "Complete Address", fullWidth: true },
    { name: "date", label: "Date Issued", type: "date", defaultToday: true },
    { name: "idNumber", label: "Barangay ID Number" },
    { name: "validUntil", label: "Valid Until", type: "date" },
    {
      name: "residentType",
      label: "Resident Type",
      type: "select",
      options: ["Existing resident", "New / renting resident"],
    },
    { name: "remarks", label: "Remarks", type: "textarea", fullWidth: true },
  ],

  "Barangay Clearance": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "age", label: "Age" },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "birthplace", label: "Birthplace" },
    {
      name: "civilStatus",
      label: "Civil Status",
      type: "select",
      options: civilStatusOptions,
    },
    {
      name: "purpose",
      label: "Purpose",
      type: "select",
      options: clearancePurposeOptions,
      fullWidth: true,
    },
    { name: "remarks", label: "Remarks", type: "textarea", fullWidth: true },
    {
      name: "validIdPresented",
      label: "Valid ID Presented",
      type: "select",
      options: idTypeOptions,
    },
    { name: "idNumber", label: "Number" },
    { name: "idPlaceOfIssue", label: "Place of Issue" },
    {
      name: "idDateOfIssue",
      label: "Date of Issue",
      type: "date",
      defaultToday: true,
    },
    {
      name: "officialReceiptNumber",
      label: "Paid under Official Receipt Number",
    },
  ],
  "Franchise Clearance": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    {
      name: "tricycleAssociation",
      label: "Tricycle Association",
      fullWidth: true,
    },
    { name: "make", label: "Make" },
    { name: "typeOfBody", label: "Type of Body" },
    { name: "motorNumber", label: "Motor Number" },
    { name: "color", label: "Color" },
    { name: "plateNumber", label: "Plate Number" },
    { name: "ctcNumber", label: "CTC Number" },
    { name: "ctcPlaceOfIssue", label: "Place of Issue" },
    {
      name: "ctcDateOfIssue",
      label: "Date of Issue",
      type: "date",
      defaultToday: true,
    },
    {
      name: "officialReceiptNumber",
      label: "Paid under Official Receipt Number",
    },
  ],
  "Barangay Clearance (Electrical and Water Connection)": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    {
      name: "serviceType",
      label: "Connection Service",
      type: "checkboxes",
      options: ["Electric", "Water"],
      fullWidth: true,
    },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    {
      name: "connectionType",
      label: "Type of Connection",
      type: "checkboxes",
      options: ["New", "Reconnection"],
      fullWidth: true,
    },
    {
      name: "classification",
      label: "Classification",
      type: "checkboxes",
      options: ["Residential", "Commercial"],
      fullWidth: true,
    },
    { name: "location", label: "Location", fullWidth: true },
    { name: "ctcNumber", label: "CTC Number" },
    { name: "ctcPlaceOfIssue", label: "Place of Issue" },
    {
      name: "ctcDateOfIssue",
      label: "Date of Issue",
      type: "date",
      defaultToday: true,
    },
    {
      name: "officialReceiptNumber",
      label: "Paid under Official Receipt Number",
    },
  ],
  "Certificate of Indigency": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "age", label: "Age" },
    {
      name: "sector",
      label: "Sector",
      type: "select",
      options: indigencySectorOptions,
    },
    { name: "purpose", label: "Purpose", type: "textarea", fullWidth: true },
    {
      name: "addressedTo",
      label: "Addressed to the Office of",
      fullWidth: true,
    },
  ],
  "Residency Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "residencyStartDate", label: "Residency Start Date", type: "date" },
    { name: "residencyDuration", label: "Residency Duration" },
    { name: "purpose", label: "Purpose", fullWidth: true },
    {
      name: "certificationText",
      label: "Certification Text",
      type: "textarea",
      fullWidth: true,
    },
  ],
  "First-Time Jobseekers Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    {
      name: "packetParts",
      label: "Packet Parts Requested",
      type: "checkboxes",
      options: [
        "Applicant Information Sheet",
        "Oath of Undertaking",
        "Barangay Certification",
      ],
      fullWidth: true,
    },
    { name: "name", label: "Applicant Name" },
    { name: "birthdate", label: "Birthdate", type: "date" },
    { name: "age", label: "Age" },
    { name: "address", label: "Complete Address", fullWidth: true },
    { name: "residencyDuration", label: "Years/Months of Residency" },
    { name: "sexGender", label: "Sex/Gender (use approved field label)" },
    {
      name: "civilStatus",
      label: "Civil Status",
      type: "select",
      options: civilStatusOptions,
    },
    { name: "educationalAttainment", label: "Educational Attainment" },
    { name: "course", label: "Course (if applicable)" },
    {
      name: "jobStartBeneficiary",
      label: "JobStart Beneficiary",
      type: "select",
      options: ["Yes", "No"],
    },
    { name: "witnessName", label: "Oath Witness" },
  ],
  "Assistance Request Certification": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name (Mr./Ms.)" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "residencyDuration", label: "Years of Residency" },
    { name: "sector", label: "Sector" },
    {
      name: "assistanceType",
      label: "Assistance Type",
      type: "select",
      options: ["Financial", "Medical", "Burial"],
    },
    {
      name: "recipientChoice",
      label: "Recipient",
      type: "select",
      options: ["Self", "Relationship / Other Recipient"],
    },
    { name: "recipientRelationship", label: "Relationship (if applicable)" },
    { name: "underName", label: "Under the Name of" },
    { name: "kagawadSignatoryNote", label: "Signatory Note", fullWidth: true },
  ],
  "Damayan": [
    { name: "date", label: "Date", type: "date", defaultToday: true },
    { name: "name", label: "Name (Mr./Ms.)" },
    { name: "address", label: "Address", fullWidth: true },
    { name: "residencyDuration", label: "Years of Residency" },
    { name: "sector", label: "Sector" },
    { name: "assistanceType", label: "Assistance Type", type: "select", options: ["Financial", "Medical", "Burial"] },
    { name: "recipientChoice", label: "Recipient", type: "select", options: ["Self", "Relationship / Other Recipient"] },
    { name: "recipientRelationship", label: "Relationship (if applicable)" },
    { name: "underName", label: "Under the Name of" },
    { name: "kagawadSignatoryNote", label: "Signatory Note", fullWidth: true },
  ],
}


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
