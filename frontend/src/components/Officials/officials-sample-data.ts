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

export const initialOfficials: OfficialRecord[] = [
  { id: "OFF-001", name: "Barangay Captain", position: "Punong Barangay", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current", elected: true },
  { id: "OFF-002", name: "Barangay Kagawad 1", position: "Barangay Kagawad", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current", elected: true },
  { id: "OFF-003", name: "Barangay Secretary", position: "Barangay Secretary", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current", elected: false },
  { id: "OFF-004", name: "Barangay Treasurer", position: "Barangay Treasurer", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current", elected: false },
  { id: "OFF-005", name: "Former Kagawad", position: "Barangay Kagawad", termStart: "2020-11-01", termEnd: "2023-10-31", status: "Former", elected: true },
  { id: "OFF-006", name: "Barangay Clerk", position: "Barangay Clerk", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current", elected: false },
  { id: "OFF-007", name: "Administrative Assistant", position: "Administrative Assistant", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current", elected: false },
  { id: "OFF-008", name: "OIC Kagawad", position: "OIC Kagawad", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current", elected: false },
]

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
