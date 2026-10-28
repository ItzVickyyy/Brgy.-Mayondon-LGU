import { createFileRoute, redirect } from "@tanstack/react-router"
import { Activity, Filter, Search } from "lucide-react"
import { UsersService } from "@/client"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/activity-log")({ component: ActivityLog, beforeLoad: async () => { const { data: user } = await UsersService.readUserMe(); if (!user.is_superuser) throw redirect({ to: "/" }) }, head: () => ({ meta: [{ title: pageTitle("All Users' Activity") }] }) })

const rows = [
  ["Oct 28, 2026 · 10:42 AM", "admin.sample", "Updated resident details", "Resident Records", "Success"],
  ["Oct 28, 2026 · 9:55 AM", "staff.sample", "Prepared document request", "Document Management", "Draft only"],
  ["Oct 27, 2026 · 4:10 PM", "admin.sample", "Changed user account status", "User Accounts", "Success"],
  ["Oct 27, 2026 · 3:32 PM", "staff.sample", "Imported masterlist preview", "Resident Records", "Preview only"],
]

function ActivityLog() {
  return <div className="flex flex-col gap-6"><div><p className="text-sm font-medium text-primary">Administration</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">All Users' Activity</h1><p className="mt-2 text-sm text-muted-foreground">Admin view of sample system activity for review and auditing.</p></div><div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-muted-foreground">Sample data only. The application is not currently recording these events in an audit log.</div><div className="flex flex-wrap gap-3"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input placeholder="Search user, action, or module" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div><select className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue="all"><option value="all">All modules</option><option>Resident Records</option><option>Document Management</option><option>User Accounts</option></select><button className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm"><Filter className="size-4" />Filters</button></div><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr>{["Timestamp","User","Action","Module","Outcome"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.join("-")} className="border-t">{row.map((cell) => <td key={cell} className="px-4 py-4">{cell}</td>)}</tr>)}</tbody></table></div><p className="text-xs text-muted-foreground"><Activity className="mr-1 inline size-3.5" />A future operational audit log should record actor, action, module, record reference, timestamp, outcome, and reason where required. It should not store passwords, tokens, or unnecessary resident details.</p></div>
}
