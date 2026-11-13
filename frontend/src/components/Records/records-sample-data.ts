export type ResidentRecord = {
  id: string
  name: string
  firstName: string
  middleName: string
  lastName: string
  suffix?: string
  birthdate: string
  birthplace: string
  sex: "Male" | "Female" | ""
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
  /** regular / new / renting; empty counts as regular (patch 61). */
  residencyType?: "regular" | "new" | "renting"
  /** Months the next Barangay ID is normally valid for this resident. */
  idValidityMonths?: 6 | 12
  /** valid_until of the latest issued, unarchived Barangay ID, if any. */
  idValidUntil?: string
  idNumber: string
  idStatus: "Valid" | "Expiring soon" | "Expired" | "None"
  registration: "Registered" | "Unregistered"
  status: "Active" | "Archived"
  archiveReason?: string
}

export const sampleResidents: ResidentRecord[] = []
