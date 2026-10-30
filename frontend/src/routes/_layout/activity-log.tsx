import { createFileRoute } from "@tanstack/react-router"
import { Filter, Search } from "lucide-react"
import { useMemo, useState } from "react"
import useAuth from "@/hooks/useAuth"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/activity-log")({ component: ActivityLog, head: () => ({ meta: [{ title: pageTitle("Activity Log") }] }) })
const rows = [
  { time: "Oct 28, 2026 · 10:42 AM", user: "admin", owner: "admin", action: "Updated resident details", module: "Resident Records", outcome: "Success" },
  { time: "Oct 28, 2026 · 9:55 AM", user: "staff", owner: "staff", action: "Prepared document request", module: "Document Management", outcome: "In progress" },
  { time: "Oct 28, 2026 · 8:04 AM", user: "staff", owner: "staff", action: "Signed in to the system", module: "Authentication", outcome: "Success" },
  { time: "Oct 27, 2026 · 4:10 PM", user: "admin", owner: "admin", action: "Changed user account status", module: "User Accounts", outcome: "Success" },
  { time: "Oct 27, 2026 · 3:32 PM", user: "staff", owner: "staff", action: "Imported masterlist", module: "Resident Records", outcome: "Completed" },
]
function ActivityLog() {
  const { user } = useAuth()
  const isAdmin = Boolean(user?.is_superuser)
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")
  const visibleRows = useMemo(() => rows.filter((row) => (isAdmin || row.owner === "staff") && (moduleFilter === "all" || row.module === moduleFilter) && [row.time, row.user, row.action, row.module, row.outcome].some((value) => value.toLowerCase().includes(search.toLowerCase()))), [isAdmin, moduleFilter, search])
  return <div className="flex flex-col gap-6"><div><p className="text-sm font-medium text-primary">System records</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Activity Log</h1><p className="mt-2 text-sm text-muted-foreground">{isAdmin ? "Review activity across user accounts." : "Review activity associated with your account."}</p></div><div className="flex flex-wrap gap-3"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isAdmin ? "Search user, action, or module" : "Search your activity"} className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div><select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All modules</option><option>Resident Records</option><option>Document Management</option><option>User Accounts</option><option>Authentication</option></select><span className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground"><Filter className="size-4" />{visibleRows.length} entries</span></div><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr>{[...(isAdmin ? ["Timestamp", "User"] : ["Timestamp"]), "Action", "Module", "Outcome"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <tr key={row.time + row.action} className="border-t"><td className="px-4 py-4">{row.time}</td>{isAdmin ? <td className="px-4 py-4">{row.user}</td> : null}<td className="px-4 py-4">{row.action}</td><td className="px-4 py-4">{row.module}</td><td className="px-4 py-4">{row.outcome}</td></tr>)}</tbody></table>{visibleRows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No matching activity found.</p> : null}</div></div>
}