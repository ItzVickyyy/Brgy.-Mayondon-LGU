export type FieldType = "text" | "date" | "textarea" | "checkboxes" | "select"
export type DocumentField = {
  name: string
  label: string
  type?: FieldType
  options?: string[]
  defaultToday?: boolean
  fullWidth?: boolean
}
export type IssuanceRecord = {
  id: string
  resident: string
  type: string
  date: string
  status: "Issued" | "Sample" | "Draft"
  fields: Record<string, string>
}

export const civilStatusOptions = [
  "Single",
  "Married",
  "Legally Seperated",
  "Widow/Widower",
]
export const idTypeOptions = [
  "CTC",
  "VIN",
  "PASSPORT",
  "UMID",
  "TIN",
  "DRIVER LICENSE",
  "SENIOR CITIZEN",
  "SOLO PARENT",
  "POSTAL ID",
  "PhilHealth",
  "PRC ID",
  "Nat'l ID",
  "SSS ID",
  "SCHOOL ID",
]
export const clearancePurposeOptions = [
  "Employment Requirement",
  "Student Permit Requirement",
  "Proof of Residency only",
  "SIDECAR Loan Application Requirement",
  "Loan Application Requirement",
  "House Loan Application Requirement",
  "Franchise Requirement",
  "Internet Connection Application Requirement",
  "Bank Requirement (Openning Bank Account)",
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
export const documentTypes = [
  "Barangay ID",
  "Barangay Clearance",
  "Franchise Clearance",
  "Barangay Clearance (Electrical and Water Connection)",
  "Certificate of Indigency",
  "First-Time Jobseekers Certification",
  "Assistance Request Certification",
  "Damayan",
]

export const documentFields: Record<string, DocumentField[]> = {
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
}

export const sampleIssuances: IssuanceRecord[] = [
  {
    id: "ISS-001",
    resident: "Resident One",
    type: "Barangay Clearance",
    date: "2026-10-23",
    status: "Issued",
    fields: {},
  },
  {
    id: "ISS-002",
    resident: "Resident Two",
    type: "Franchise Clearance",
    date: "2026-10-22",
    status: "Issued",
    fields: {},
  },
  {
    id: "ISS-003",
    resident: "Resident Three",
    type: "Barangay Clearance (Electrical and Water Connection)",
    date: "2026-10-22",
    status: "Issued",
    fields: {},
  },
  {
    id: "ISS-004",
    resident: "Resident Four",
    type: "Certificate of Indigency",
    date: "2026-10-21",
    status: "Issued",
    fields: {},
  },
]
