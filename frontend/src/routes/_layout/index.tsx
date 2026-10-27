import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, Clock3, FileCheck2, Printer, Users, AlertTriangle } from "lucide-react"

import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: pageTitle("Dashboard") }] }),
})

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: typeof Users
}) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
    </article>
  )
}

function QuickAction({ to, title, description, icon: Icon }: {
  to: "/" | "/records" | "/issuances"
  title: string
  description: string
  icon: typeof Users
}) {
  return (
    <Link to={to} className="group flex min-w-0 items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Barangay Mayondon Records and Document Issuance System</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          A starting point for resident records, document preparation, and Barangay ID workflows. Summary values will appear when the corresponding database features are connected.
        </p>
      </div>

      <section aria-label="Summary statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Resident Records" value="—" description="Total active resident records" icon={Users} />
        <SummaryCard title="Documents Issued" value="—" description="For the selected reporting period" icon={FileCheck2} />
        <SummaryCard title="Expiring Documents" value="—" description="Clearances or IDs nearing expiry" icon={Clock3} />
        <SummaryCard title="Pending Requests" value="—" description="Requests awaiting staff processing" icon={AlertTriangle} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">Quick Actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Go directly to a common office task.</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <QuickAction to="/records" title="Find a Resident" description="Search existing records before entering information again." icon={Users} />
            <QuickAction to="/issuances" title="Prepare a Document" description="Start a document workflow and review the print details." icon={Printer} />
            <QuickAction to="/issuances" title="Review Issuance History" description="Open the current document management draft." icon={FileCheck2} />
            <QuickAction to="/records" title="Review Resident Records" description="Browse the current resident records prototype." icon={ArrowRight} />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">Reminders</h2>
            <p className="mt-1 text-sm text-muted-foreground">Planned dashboard information.</p>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex gap-3 rounded-lg border border-dashed p-3">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Expiring clearances and IDs</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Expiry reminders need connected records and a confirmed reminder window.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-dashed p-3">
              <Printer className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Pre-printed form alignment</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Printed fields must be calibrated and checked against the office's actual forms and printer.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="text-xs leading-5 text-muted-foreground">
        Design prototype only. Dashboard totals, expiry reminders, and recent activity are not connected to live records yet. Do not use this screen as an operational report.
      </p>
    </div>
  )
}
