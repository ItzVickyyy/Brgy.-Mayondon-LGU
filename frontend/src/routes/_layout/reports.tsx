import { createFileRoute } from "@tanstack/react-router"
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react"
import { useState } from "react"
import { NoPermission } from "@/components/Common/NoPermission"
import { StatCard } from "@/components/Common/StatCard"
import { formControlClass } from "@/components/Common/formStyles"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export const Route = createFileRoute("/_layout/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: pageTitle("Management Reports") }] }),
})

const summary = [
  {
    label: "Documents issued",
    value: "128",
    note: "Total records",
    icon: FileText,
  },
  {
    label: "Resident records",
    value: "1,284",
    note: "Total records",
    icon: UsersRound,
  },
  {
    label: "Monthly change",
    value: "+12%",
    note: "Compared with previous period",
    icon: TrendingUp,
  },
]

function Reports() {
  const { user } = useAuth()
  const [period, setPeriod] = useState("month")
  const [report, setReport] = useState("issuances")
  const [notice, setNotice] = useState("")
  if (!isSystemAdministrator(user)) return <NoPermission />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Management Reports
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review document issuance and resident-record activity.
        </p>
      </div>
      {notice ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setNotice("")} aria-label="Dismiss message"><X aria-hidden="true" /></Button>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => (
          <StatCard key={item.label} icon={item.icon} label={item.label} value={item.value} description={item.note} />
        ))}
      </div>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Report type
            <select
              value={report}
              onChange={(event) => setReport(event.target.value)}
              className={`${formControlClass} min-w-52 font-normal`}
            >
              <option value="issuances">Issuances by document type</option>
              <option value="purpose">Issuances by purpose</option>
              <option value="expiry">Expiring records</option>
              <option value="imports">Masterlist import summary</option>
              <option value="accounts">Account activity</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Reporting period
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className={`${formControlClass} min-w-40 font-normal`}
            >
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
            </select>
          </label>
          <Button onClick={() => setNotice(`Report selected: ${report}, ${period}.`)}>
            <BarChart3 aria-hidden="true" />
            Preview Report
          </Button>
          <Button variant="outline" onClick={() => setNotice("Export requested.")}>
            <Download aria-hidden="true" />
            Export
          </Button>
        </div>
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center">
          <BarChart3 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Report preview area</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Results for the selected report will appear here.
          </p>
        </div>
      </section>
    </div>
  )
}
