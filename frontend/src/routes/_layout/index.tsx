import { createFileRoute, Link } from "@tanstack/react-router"
import { Activity, FileCheck2, House, Users, Vote, TrendingUp, ChartPie, CalendarDays } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"

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
  today: 12,
  week: 68,
  month: 214,
  "3months": 592,
  "6months": 1087,
  year: 1924,
  overall: 8421,
}

const monthlyIssuances = [
  { month: "May", count: 138 },
  { month: "Jun", count: 162 },
  { month: "Jul", count: 149 },
  { month: "Aug", count: 188 },
  { month: "Sep", count: 176 },
  { month: "Oct", count: 214 },
]

const documentTypes = [
  { name: "Barangay Clearance", count: 74 },
  { name: "Certificate of Residency", count: 48 },
  { name: "Certificate of Indigency", count: 36 },
  { name: "Barangay ID", count: 29 },
  { name: "Other Documents", count: 27 },
]

const activities = [
  { title: "Barangay Clearance issued", detail: "Resident record #0001", time: "Today, 10:42 AM" },
  { title: "Resident record updated", detail: "Resident record #0002", time: "Today, 9:18 AM" },
  { title: "Household record added", detail: "Household record #0003", time: "Yesterday, 3:26 PM" },
  { title: "Certificate of Residency issued", detail: "Resident record #0004", time: "Yesterday, 1:05 PM" },
]

function SummaryCard({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: typeof Users }) {
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

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

function Dashboard() {
  const [period, setPeriod] = useState<Period>("overall")
  const maxMonthly = Math.max(...monthlyIssuances.map((item) => item.count))
  const totalByType = useMemo(() => documentTypes.reduce((sum, item) => sum + item.count, 0), [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Admin Portal</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">An overview of household, population, voter, and document records.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground sm:self-auto">
          <CalendarDays className="size-4" aria-hidden="true" />
          <span>Dashboard overview</span>
        </div>
      </div>

      <section aria-label="Summary statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Population" value="12,480" description="Resident records" icon={Users} />
        <SummaryCard title="Total Households" value="3,126" description="Household records" icon={House} />
        <SummaryCard title="Registered Voters" value="7,842" description="Registered voter records" icon={Vote} />
        <SummaryCard title="Documents Issued" value={documentsByPeriod[period].toLocaleString()} description={periodLabels[period]} icon={FileCheck2} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading title="Document Issuances Over Time" description="Monthly issuance volume" />
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Period</span>
              <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3 border-b px-1 sm:gap-5">
            {monthlyIssuances.map((item) => (
              <div key={item.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                <div className="w-full max-w-12 rounded-t-md bg-primary/80 transition-all" style={{ height: `${(item.count / maxMonthly) * 72}%` }} />
                <span className="pb-2 text-xs text-muted-foreground">{item.month}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Historical records are needed to report population or issuance trends accurately.</p>
        </article>

        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title="Issuances by Document Type" description="Distribution for the selected reporting period" />
          <div className="mt-5 space-y-4">
            {documentTypes.map((item) => (
              <div key={item.name}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / totalByType) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{totalByType}</span>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title="Resident Demographics" description="Proposed population breakdowns for reporting" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { title: "By Sex", detail: "Resident distribution" },
              { title: "By Age", detail: "Age-group distribution" },
              { title: "By Sector", detail: "Approved sector categories" },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border bg-muted/20 p-4">
                <ChartPie className="mb-3 size-5 text-primary" aria-hidden="true" />
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">Needs data validation</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title="Population Growth" description="Proposed comparison using historical resident totals" />
          <div className="mt-5 flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center">
            <TrendingUp className="size-7 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium">Historical population data needed</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">This section can show growth only when reliable resident totals from previous periods are available.</p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title="Expiring IDs and Clearances" description="Records that may need attention soon" />
          <div className="mt-4 divide-y">
            {[
              { name: "Barangay ID · Resident Two", date: "Nov 20, 2026", status: "Expiring soon" },
              { name: "Barangay Clearance · Resident Four", date: "Nov 24, 2026", status: "Review date" },
              { name: "Barangay ID · Resident Three", date: "Dec 02, 2026", status: "Upcoming" },
            ].map((item) => (
              <div key={item.name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">Expiry date: {item.date}</p></div>
                <span className="inline-flex min-h-8 items-center self-start rounded-full border px-3 text-xs font-semibold sm:self-center">{item.status}</span>
              </div>
            ))}
          </div>
          <Link to="/issuances" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">Open issuance history</Link>
        </article>
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title="Quick Actions" description="Common tasks for the barangay office" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { title: "Find a resident", description: "Search resident and ID records", to: "/records", icon: Users },
              { title: "Create an issuance", description: "Start a new document request", to: "/issuances", icon: FileCheck2 },
              { title: "Review issuance history", description: "Find previous document records", to: "/issuances", icon: CalendarDays },
              { title: "View dashboard activity", description: "Review recent office actions", to: "/activity-log", icon: Activity },
            ].map((item) => (
              <Link key={item.title} to={item.to} className="group flex min-h-24 items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="rounded-lg bg-primary/10 p-2 text-primary"><item.icon className="size-5" aria-hidden="true" /></span>
                <span><span className="block font-semibold group-hover:text-primary">{item.title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span></span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Activity className="size-5" aria-hidden="true" /></div>
          <div>
            <SectionHeading title="Recent Activities" description="Latest system activity" />
          </div>
        </div>
        <div className="mt-4 divide-y">
          {activities.map((activity) => (
            <div key={activity.title + activity.time} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <p className="text-sm font-medium">{activity.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activity.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{activity.time}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Activity history appears here as actions are recorded.</p>
      </section>

    </div>
  )
}
