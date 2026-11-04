import { useSyncExternalStore } from "react"

export type RegistrationStatus = "Pending" | "Approved" | "Rejected"

export type Registration = {
  username: string
  name: string
  position: string
  submitted: string
  status: RegistrationStatus
  decidedBy?: string
  decidedOn?: string
  rejectionReason?: string
}

let registrations: Registration[] = []
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => {
    listener()
  })
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
  decidedBy = "admin",
  rejectionReason?: string,
): void {
  const current = registrations.find((row) => row.username === username)
  if (!current || current.status !== "Pending") return
  const decidedOn = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date())
  registrations = registrations.map((row) =>
    row.username === username
      ? {
          ...row,
          status,
          decidedBy,
          decidedOn,
          rejectionReason: status === "Rejected" ? rejectionReason : undefined,
        }
      : row,
  )
  notify()
}
