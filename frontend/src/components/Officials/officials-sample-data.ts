export type OfficialStatus = "Current" | "Former"
export type OfficialRecord = {
  id: string
  name: string
  position: string
  termStart: string
  termEnd: string
  status: OfficialStatus
}

export const initialOfficials: OfficialRecord[] = [
  { id: "OFF-001", name: "Barangay Captain", position: "Punong Barangay", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current" },
  { id: "OFF-002", name: "Barangay Kagawad 1", position: "Barangay Kagawad", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current" },
  { id: "OFF-003", name: "Barangay Secretary", position: "Barangay Secretary", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current" },
  { id: "OFF-004", name: "Barangay Treasurer", position: "Barangay Treasurer", termStart: "2023-11-01", termEnd: "2026-11-30", status: "Current" },
  { id: "OFF-005", name: "Former Kagawad", position: "Barangay Kagawad", termStart: "2020-11-01", termEnd: "2023-10-31", status: "Former" },
]
