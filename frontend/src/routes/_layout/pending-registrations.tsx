import { createFileRoute, redirect } from "@tanstack/react-router"
import { Check, Clock3, Search, UserRoundCheck, X } from "lucide-react"
import { useState } from "react"
import { UsersService } from "@/client"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/pending-registrations")({ component: PendingRegistrations, beforeLoad: async () => { const { data: user } = await UsersService.readUserMe(); if (!user.is_superuser) throw redirect({ to: "/" }) }, head: () => ({ meta: [{ title: pageTitle("Pending Registrations") }] }) })

const initialRows = [
  { name: "Sample Staff Applicant A", username: "staff.sample.a", date: "Oct 28, 2026", status: "Pending" },
  { name: "Sample Staff Applicant B", username: "staff.sample.b", date: "Oct 27, 2026", status: "Pending" },
]

function PendingRegistrations() {
  const [rows, setRows] = useState(initialRows)
  const [notice, setNotice] = useState("")
  const decide = (username: string, action: "approved" | "rejected") => { setRows((current) => current.map((row) => row.username === username ? { ...row, status: action === "approved" ? "Approved (sample)" : "Rejected (sample)" } : row)); setNotice(`Sample action only: ${username} marked ${action}. No account status was changed.`) }
  return <div className="flex flex-col gap-6"><div><p className="text-sm font-medium text-primary">Administration</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Pending Registrations</h1><p className="mt-2 text-sm text-muted-foreground">Review staff self-registration requests before access is granted.</p></div><div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-muted-foreground">Sample design only. Approval and rejection actions do not create, activate, or reject accounts.</div>{notice ? <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{notice}</p> : null}<div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input placeholder="Search applicants..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div><span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><Clock3 className="size-4" />{rows.filter((row) => row.status === "Pending").length} pending</span></div><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr>{["Applicant","Requested username","Submitted","Status","Actions"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.username} className="border-t"><td className="px-4 py-4"><span className="inline-flex items-center gap-2"><UserRoundCheck className="size-4 text-muted-foreground" />{row.name}</span></td><td className="px-4 py-4">{row.username}</td><td className="px-4 py-4">{row.date}</td><td className="px-4 py-4"><span className="rounded-full border px-2.5 py-1 text-xs">{row.status}</span></td><td className="px-4 py-4"><div className="flex gap-2"><button disabled={row.status !== "Pending"} onClick={() => decide(row.username, "approved")} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40"><Check className="size-3.5" />Approve</button><button disabled={row.status !== "Pending"} onClick={() => decide(row.username, "rejected")} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40"><X className="size-3.5" />Reject</button></div></td></tr>)}</tbody></table></div></div>
}
