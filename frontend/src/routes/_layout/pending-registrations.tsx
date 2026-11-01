import { createFileRoute, redirect } from "@tanstack/react-router"
import { Check, Clock3, Search, UserRoundCheck, X } from "lucide-react"
import { useMemo, useState } from "react"

import { UsersService } from "@/client"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/pending-registrations")({
  component: PendingRegistrations,
  beforeLoad: async () => {
    const { data: user } = await UsersService.readUserMe()
    if (!user.is_superuser) throw redirect({ to: "/" })
  },
  head: () => ({ meta: [{ title: pageTitle("Pending Registrations") }] }),
})

type Registration = {
  username: string
  name: string
  submitted: string
  status: "Pending" | "Approved" | "Rejected"
}

// Fictional examples for layout review only. These decisions are not saved.
const initialRegistrations: Registration[] = [
  { name: "Staff Applicant 1", username: "staff.applicant1", submitted: "Oct 28, 2026", status: "Pending" },
  { name: "Staff Applicant 2", username: "staff.applicant2", submitted: "Oct 27, 2026", status: "Pending" },
]

function PendingRegistrations() {
  const [registrations, setRegistrations] = useState(initialRegistrations)
  const [search, setSearch] = useState("")
  const visibleRegistrations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return registrations.filter((row) =>
      [row.name, row.username, row.submitted, row.status].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [registrations, search])

  const decide = (username: string, status: "Approved" | "Rejected") => {
    const action = status === "Approved" ? "approve" : "reject"
    if (!window.confirm(`Are you sure you want to ${action} this sample request?`)) return
    setRegistrations((current) =>
      current.map((row) => row.username === username ? { ...row, status } : row),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pending Registrations</h1>
        <p className="mt-2 text-muted-foreground">Review sample staff access requests. This prototype does not save decisions or create accounts.</p>
      </div>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        Prototype only. The requests below are fictional examples, and approve/reject actions are temporary local state.
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm">
          <Clock3 className="size-4" aria-hidden="true" />
          {registrations.filter((row) => row.status === "Pending").length} pending
        </span>
        <label className="relative block w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input aria-label="Search registrations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicants..." className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[680px] text-left text-base">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>{["Applicant", "Requested username", "Submitted", "Status", "Actions"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRegistrations.map((row) => (
              <tr key={row.username} className="border-t">
                <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><UserRoundCheck className="size-4 text-muted-foreground" aria-hidden="true" />{row.name}</span></td>
                <td className="px-4 py-4">{row.username}</td>
                <td className="px-4 py-4">{row.submitted}</td>
                <td className="px-4 py-4"><span className="rounded-full border px-2.5 py-1 text-sm">{row.status}</span></td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <button type="button" disabled={row.status !== "Pending"} onClick={() => decide(row.username, "Approved")} className="inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-40"><Check className="size-4" aria-hidden="true" />Approve</button>
                    <button type="button" disabled={row.status !== "Pending"} onClick={() => decide(row.username, "Rejected")} className="inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-40"><X className="size-4" aria-hidden="true" />Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRegistrations.length === 0 ? <p className="p-8 text-center text-base text-muted-foreground">No registrations found.</p> : null}
      </div>
    </div>
  )
}
