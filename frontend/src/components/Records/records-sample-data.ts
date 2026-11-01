export type ResidentRecord = {
  id: string
  name: string
  address: string
  residentType: string
  idNumber: string
  registration: "Registered" | "Unregistered"
  status: "Active" | "Archived"
}

export const sampleResidents: ResidentRecord[] = [
  {
    id: "RES-0001",
    name: "Resident One",
    address: "Mayondon, Los Baños",
    residentType: "Existing resident",
    idNumber: "18-128-3597-0001",
    registration: "Registered",
    status: "Active",
  },
  {
    id: "RES-0002",
    name: "Resident Two",
    address: "Mayondon, Los Baños",
    residentType: "New / renting resident",
    idNumber: "18-128-3597-0002",
    registration: "Unregistered",
    status: "Active",
  },
  {
    id: "RES-0003",
    name: "Resident Three",
    address: "Mayondon, Los Baños",
    residentType: "Existing resident",
    idNumber: "18-128-3597-0003",
    registration: "Registered",
    status: "Active",
  },
  {
    id: "RES-0004",
    name: "Resident Four",
    address: "Mayondon, Los Baños",
    residentType: "Existing resident",
    idNumber: "18-128-3597-0004",
    registration: "Unregistered",
    status: "Archived",
  },
]
