export type ResidentRecord = {
  id: string
  name: string
  firstName: string
  middleName: string
  lastName: string
  birthdate: string
  birthplace: string
  sex: "Male" | "Female"
  emergencyContact?: { name: string; address: string; phone: string }
  civilStatus: string
  sectors: string[]
  residentSince: number
  photoUrl?: string
  address: string
  residentType: string
  idNumber: string
  idStatus: "Valid" | "Expiring soon" | "Expired" | "None"
  registration: "Registered" | "Unregistered"
  status: "Active" | "Archived"
  archiveReason?: string
}

export const sampleResidents: ResidentRecord[] = [
  {
    id: "RES-0001",
    name: "Resident One",
    sex: "Male",
    firstName: "Fictional",
    middleName: "A.",
    lastName: "Resident",
    birthdate: "1990-03-14",
    birthplace: "Purok 1",
    civilStatus: "Single",
    sectors: ["STUDENT"],
    residentSince: 2008,
    address: "Purok 1, Mayondon",
    residentType: "Existing resident",
    idNumber: "18-128-3597-0001",
    idStatus: "Valid",
    registration: "Registered",
    status: "Active",
  },
  {
    id: "RES-0002",
    name: "Resident Two",
    sex: "Female",
    firstName: "Sample",
    middleName: "B.",
    lastName: "Resident",
    birthdate: "1985-07-22",
    birthplace: "Purok 2",
    civilStatus: "Married",
    sectors: ["STUDENT"],
    residentSince: 2005,
    address: "Purok 2, Mayondon",
    residentType: "New / renting resident",
    idNumber: "18-128-3597-0002",
    idStatus: "Expiring soon",
    registration: "Unregistered",
    status: "Active",
  },
  {
    id: "RES-0003",
    name: "Resident Three",
    sex: "Male",
    firstName: "Example",
    middleName: "C.",
    lastName: "Resident",
    birthdate: "2001-11-06",
    birthplace: "Purok 3",
    civilStatus: "Single",
    sectors: ["STUDENT"],
    residentSince: 2020,
    address: "Purok 3, Mayondon",
    residentType: "Existing resident",
    idNumber: "18-128-3597-0003",
    idStatus: "Expired",
    registration: "Registered",
    status: "Active",
  },
  {
    id: "RES-0004",
    name: "Resident Four",
    sex: "Female",
    firstName: "Mock",
    middleName: "D.",
    lastName: "Resident",
    birthdate: "1972-01-18",
    birthplace: "Purok 4",
    civilStatus: "Widow/Widower",
    sectors: ["STUDENT"],
    residentSince: 1999,
    address: "Purok 4, Mayondon",
    residentType: "Existing resident",
    idNumber: "18-128-3597-0004",
    idStatus: "None",
    registration: "Unregistered",
    status: "Archived",
  },
]
