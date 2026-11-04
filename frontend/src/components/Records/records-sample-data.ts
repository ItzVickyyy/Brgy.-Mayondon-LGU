export type ResidentRecord = {
  id: string
  name: string
  firstName: string
  middleName: string
  lastName: string
  suffix?: string
  birthdate: string
  birthplace: string
  sex: "Male" | "Female"
  emergencyContact?: { name: string; address: string; phone: string }
  civilStatus: string
  sectors: string[]
  residentSince: number | undefined
  residentSinceBirth?: boolean
  photoUrl?: string
  address: string
  houseNumber?: string
  street?: string
  purok?: number
  residentType: string
  idNumber: string
  idStatus: "Valid" | "Expiring soon" | "Expired" | "None"
  registration: "Registered" | "Unregistered"
  status: "Active" | "Archived"
  archiveReason?: string
}

export const sampleResidents: ResidentRecord[] = []
