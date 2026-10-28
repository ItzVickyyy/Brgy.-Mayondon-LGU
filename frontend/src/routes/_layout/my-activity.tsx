import { createFileRoute } from "@tanstack/react-router"
import { Activity, CalendarDays, FileText, KeyRound, UserRound } from "lucide-react"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/my-activity")({ component: MyActivity, head: () => ({ meta: [{ title: pageTitle("My Activity") }] }) })

const rows = [
  { action: "Updated resident details", module: "Resident Records", time: "Oct 28, 2026 · 10:42 AM", icon: UserRound, result: "Success" },
  { action: "Prepared document request", module: "Document Management", time: "Oct 28, 2026 · 9:55 AM", icon: FileText, result: "Draft only" },
  { action: "Signed in to the system", module: "Authentication", time: "Oct 28, 2026 · 8:04 AM", icon: KeyRound, result: "Success" },
]

function MyActivity() {
  return <div className="flex flex-col gap-6"><div><p className="text-sm font-medium text-primary">Personal account</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">My Activity</h1><p className="mt-2 text-sm text-muted-foreground">A sample view of actions performed by the signed-in staff account.</p></div><div className="rounded-xl border bg-card"><div className="flex items-center gap-3 border-b p-5"><Activity className="size-5 text-primary" /><div><h2 className="font-semibold">Recent activity</h2><p className="text-sm text-muted-foreground">Sample records only. Activity logging is not connected.</p></div></div><div className="divide-y">{rows.map((row) => <div key={row.action} className="flex flex-wrap items-start gap-3 p-4 sm:p-5"><div className="rounded-lg bg-muted p-2"><row.icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="font-medium">{row.action}</p><p className="mt-1 text-sm text-muted-foreground">{row.module}</p></div><div className="text-sm sm:text-right"><p className="inline-flex items-center gap-1 text-muted-foreground"><CalendarDays className="size-3.5" />{row.time}</p><p className="mt-1 text-xs">{row.result}</p></div></div>)}</div></div></div>
}
