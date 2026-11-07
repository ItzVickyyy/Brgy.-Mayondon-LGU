export type OfficialStatus = "Current" | "Former"
export type OfficialPosition =
  | "Punong Barangay"
  | "Barangay Kagawad"
  | "SK Chairperson"
  | "OIC Kagawad"
  | "Barangay Secretary"
  | "Barangay Treasurer"
  | "Barangay Clerk"
  | "Administrative Assistant"

export type OfficialRecord = {
  id: string
  name: string
  position: OfficialPosition | string
  termStart: string
  termEnd: string
  status: OfficialStatus
  elected: boolean
}

export const initialOfficials: OfficialRecord[] = []

export function getSignatories(): OfficialRecord[] {
  const rank: Record<string, number> = {
    "Punong Barangay": 0,
    "Barangay Kagawad": 1,
    "OIC Kagawad": 2,
  }

  return initialOfficials
    .filter((official) =>
      official.status === "Current" &&
      ["Punong Barangay", "Barangay Kagawad", "OIC Kagawad"].includes(official.position),
    )
    .sort((a, b) =>
      (rank[a.position] ?? 99) - (rank[b.position] ?? 99) ||
      a.name.localeCompare(b.name),
    )
}

export function getWitnesses(): OfficialRecord[] {
  return initialOfficials
    .filter((official) => official.status === "Current" && !official.elected)
    .sort((a, b) => a.name.localeCompare(b.name))
}
