import { useSyncExternalStore } from "react"

export type RegistrationStatus = "Pending" | "Approved" | "Rejected"

export type Registration = {
  username: string
  name: string
  submitted: string
  status: RegistrationStatus
}

// Fictional examples for layout review only. These decisions are not saved.
let registrations: Registration[] = [
  {
    name: "Staff Applicant 1",
    username: "staff.applicant1",
    submitted: "Oct 28, 2026",
    status: "Pending",
  },
  {
    name: "Staff Applicant 2",
    username: "staff.applicant2",
    submitted: "Oct 27, 2026",
    status: "Pending",
  },
]

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

export function getRegistrations(): Registration[] {
  return registrations
}

export function subscribeRegistrations(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useRegistrations(): Registration[] {
  return useSyncExternalStore(
    subscribeRegistrations,
    getRegistrations,
    getRegistrations,
  )
}

export function updateRegistrationStatus(
  username: string,
  status: Exclude<RegistrationStatus, "Pending">,
): void {
  const current = registrations.find((row) => row.username === username)
  if (!current || current.status !== "Pending") return
  registrations = registrations.map((row) =>
    row.username === username ? { ...row, status } : row,
  )
  notify()
}
