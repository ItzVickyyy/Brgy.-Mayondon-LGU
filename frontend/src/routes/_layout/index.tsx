import { createFileRoute, Link } from "@tanstack/react-router"
import { Activity, FileCheck2, Users, CalendarDays, IdCard, Clock3 } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: pageTitle("Dashboard") }] }),
})

type Period = "today" | "week" | "month" | "3months" | "6months" | "year" | "overall"

const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  "3months": "Past 3 Months",
  "6months": "Past 6 Months",
  year: "This Year",
  overall: "Overall",
}

const documentsByPeriod: Record<Period, number> = {
  today: 0,
  week: 0,
  month: 0,
  "3months": 0,
  "6months": 0,
  year: 0,
  overall: 0,
}

const monthlyIssuances: { month: string; count: number }[] = []

const documentTypes: { name: string; count: number }[] = []

const staffActivities: { title: string; detail: string; time: string }[] = []
const adminActivities: { title: string; detail: string; time: string }[] = []

function SummaryCard({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: typeof Users }) {
  return (
    <article className="rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/15 p-2.5 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
    </article>
  )
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const isAdmin = Boolean(user?.is_superuser)
  const [period, setPeriod] = useState<Period>("overall")
  const visibleMonths = useMemo(() => {
    if (period === "today" || period === "week" || period === "month") return monthlyIssuances.slice(-1)
    if (period === "3months") return monthlyIssuances.slice(-3)
    if (period === "6months") return monthlyIssuances.slice(-6)
    return monthlyIssuances
  }, [period])
  const maxMonthly = Math.max(1, ...visibleMonths.map((item) => item.count))
  const baseTypeTotal = useMemo(() => documentTypes.reduce((sum, item) => sum + item.count, 0), [])
  const totalByType = documentsByPeriod[period]
  const visibleDocumentTypes = useMemo(() => baseTypeTotal > 0 ? documentTypes.map((item) => ({ ...item, count: Math.round((item.count / baseTypeTotal) * totalByType) })) : [], [baseTypeTotal, totalByType])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">An overview of document issuance, upcoming expiries, and work requiring attention.</p>
        </div>
        <label className="flex items-center gap-2 self-start text-sm sm:self-auto">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Period</span>
          <select aria-label="Dashboard reporting period" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="min-h-11 rounded-md border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <section aria-label="Summary statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Documents Issued This Month" value="0" description="Total this month" icon={FileCheck2} />
        <SummaryCard title="Clearances Expiring in 30 Days" value="0" description="Due within 30 days" icon={Clock3} />
        <SummaryCard title="Barangay IDs Expiring in 30 Days" value="0" description="Due within 30 days" icon={IdCard} />
        <SummaryCard title={isAdmin ? "Pending Registrations" : "Pending Document Requests"} value="0" description="Awaiting review" icon={Users} />
      </section>

      <section aria-label="Quick actions">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title="Quick Actions" />
          <div className="mt-3 flex flex-col gap-3 lg:flex-row">
            {[
              { title: "Find a resident", description: "Search resident and ID records", to: "/records", icon: Users },
              { title: "Create an issuance", description: "Start a new document request", to: "/issuances", icon: FileCheck2 },
              { title: "Review issuance history", description: "Find previous document records", to: "/issuances", icon: CalendarDays },
              { title: "View dashboard activity", description: "Review recent office actions", to: "/activity-log", icon: Activity },
            ].map((item) => (
              <Link key={item.title} to={item.to} className="group flex min-h-16 items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-1">
                <span className="rounded-lg bg-primary/15 p-2 text-primary"><item.icon className="size-5" aria-hidden="true" /></span>
                <span><span className="block font-semibold group-hover:text-primary">{item.title}</span><span className="block text-sm leading-5 text-muted-foreground">{item.description}</span></span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col items-start gap-2"><SectionHeading title="Document Issuances Over Time" description="Monthly issuance volume" /></div>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3 border-b px-1 sm:gap-5">
            {visibleMonths.map((item) => (
              <div key={item.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                <div className="w-full max-w-12 rounded-t-md bg-primary/80 transition-all" style={{ height: `${(item.count / maxMonthly) * 72}%` }} />
                <span className="pb-2 text-xs text-muted-foreground">{item.month}</span>
              </div>
            ))}
            {visibleMonths.length === 0 ? <p className="w-full self-center text-center text-sm text-muted-foreground">No issuance history yet.</p> : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Historical records are needed to report population or issuance trends accurately.</p>
        </article>

        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start gap-2"><SectionHeading title="Issuances by Document Type" description="Distribution for the selected reporting period" /></div>
          <div className="mt-5 space-y-4">
            {visibleDocumentTypes.map((item) => (
              <div key={item.name}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${totalByType > 0 ? (item.count / totalByType) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {visibleDocumentTypes.length === 0 ? <p className="text-sm text-muted-foreground">No issuance records yet.</p> : null}
          </div>
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{totalByType}</span>
          </div>
        </article>
      </section>

      <section className="grid gap-4">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start gap-2"><SectionHeading title="Expiring IDs and Clearances" description="Records that may need attention soon" /></div>
          <div className="mt-4 divide-y">
            {([] as { name: string; date: string; status: string }[]).map((item) => (
              <div key={item.name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">Expiry date: {item.date}</p></div>
                <span className="inline-flex min-h-8 items-center self-start rounded-full border px-3 text-xs font-semibold sm:self-center">{item.status}</span>
              </div>
            ))}
            <p className="py-3 text-sm text-muted-foreground">No records are expiring soon.</p>
          </div>
          <Link to="/issuances" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">Open issuance history</Link>
        </article>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Activity className="size-5" aria-hidden="true" /></div>
          <div>
            <div className="flex flex-col items-start gap-2"><SectionHeading title="Recent Activities" description={isAdmin ? "Recent system-wide activity" : "Your recent activity"} /></div>
          </div>
        </div>
        <div className="mt-4 divide-y">
          {(isAdmin ? adminActivities : staffActivities).map((activity) => (
            <div key={activity.title + activity.time} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <p className="text-sm font-medium">{activity.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activity.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{activity.time}</span>
            </div>
          ))}
          {(isAdmin ? adminActivities : staffActivities).length === 0 ? <p className="py-3 text-sm text-muted-foreground">No activity recorded yet.</p> : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Activity history appears here as actions are recorded.</p>
      </section>

    </div>
  )
}
