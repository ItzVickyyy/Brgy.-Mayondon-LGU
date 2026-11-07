import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Activity,
  CalendarDays,
  Clock3,
  FileCheck2,
  IdCard,
  Users,
} from "lucide-react"
import { useState } from "react"

import { ActivityService, DashboardService } from "@/client"
import { ErrorState, LoadingState } from "@/components/Common/FeedbackState"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { activityTitle } from "@/lib/activity"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: pageTitle("Dashboard") }] }),
})

type Period =
  | "today"
  | "week"
  | "month"
  | "3months"
  | "6months"
  | "year"
  | "overall"

const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  "3months": "Past 3 Months",
  "6months": "Past 6 Months",
  year: "This Year",
  overall: "Overall",
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
})
const timeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
})

// "2026-11" -> "Nov 26"; the year is two digits so a long range still fits.
function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number)
  const name = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  })
  return `${name} ${String(year).slice(-2)}`
}

// "2026-12-06" is a business date, not a moment: format it without time zones.
function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return dateFormat.format(new Date(year, month - 1, day))
}

function expiryText(daysLeft: number) {
  if (daysLeft <= 0) return "Expires today"
  return daysLeft === 1 ? "Expires in 1 day" : `Expires in ${daysLeft} days`
}

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
    <article className="rounded-xl border border-brand/25 bg-brand/5 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {value}
          </p>
        </div>
        <div className="rounded-lg bg-brand/15 p-2.5 text-brand">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
    </article>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const isAdmin = Boolean(user?.is_superuser)
  const [period, setPeriod] = useState<Period>("overall")
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", period],
    queryFn: async () =>
      (await DashboardService.dashboard({ query: { period } })).data,
  })
  // Staff always get only their own rows from this endpoint; Admin gets everyone's.
  const activityQuery = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () =>
      (await ActivityService.listActivity({
          query: { limit: 5, exclude_module: "auth" },
        })).data,
  })
  const dashboard = dashboardQuery.data
  const summary = dashboard?.summary
  const months = dashboard?.issuances_over_time ?? []
  const maxMonthly = Math.max(1, ...months.map((item) => item.count))
  const types = dashboard?.by_document_type ?? []
  const totalByType = dashboard?.total_issued ?? 0
  const expiring = dashboard?.expiring ?? []
  const activities = activityQuery.data?.data ?? []
  const number = (value: number | undefined) =>
    value === undefined ? "–" : String(value)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An overview of document issuance, upcoming expiries, and work
            requiring attention.
          </p>
        </div>
        <label className="flex items-center gap-2 self-start text-sm sm:self-auto">
          <CalendarDays
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">Period</span>
          <select
            aria-label="Dashboard reporting period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="min-h-11 rounded-md border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(periodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dashboardQuery.isLoading ? (
        <LoadingState title="Loading dashboard..." />
      ) : null}
      {dashboardQuery.isError ? (
        <ErrorState
          title="Unable to load the dashboard"
          description="Check your connection and try again."
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}

      <section
        aria-label="Summary statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          title="Documents Issued This Month"
          value={number(summary?.documents_issued_this_month)}
          description="Total this month"
          icon={FileCheck2}
        />
        <SummaryCard
          title="Clearances Expiring in 30 Days"
          value={number(summary?.clearances_expiring)}
          description={`Due within ${summary?.clearance_window_days ?? 30} days`}
          icon={Clock3}
        />
        <SummaryCard
          title="Barangay IDs Expiring in 30 Days"
          value={number(summary?.barangay_ids_expiring)}
          description={`Due within ${summary?.id_window_days ?? 30} days`}
          icon={IdCard}
        />
        <SummaryCard
          title="Pending Document Requests"
          value={number(summary?.open_drafts)}
          description="Drafts not yet issued"
          icon={Users}
        />
      </section>

      <section aria-label="Quick actions">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title="Quick Actions" />
          <div className="mt-3 flex flex-col gap-3 lg:flex-row">
            {[
              {
                title: "Find a resident",
                description: "Search resident and ID records",
                to: "/records",
                icon: Users,
              },
              {
                title: "Create an issuance",
                description: "Start a new document request",
                to: "/issuances",
                icon: FileCheck2,
              },
              {
                title: "Review issuance history",
                description: "Find previous document records",
                to: "/issuances",
                icon: CalendarDays,
              },
              {
                title: "View dashboard activity",
                description: "Review recent office actions",
                to: "/activity-log",
                icon: Activity,
              },
            ].map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group flex min-h-16 items-center gap-3 rounded-xl border border-brand/25 bg-brand/5 p-3 transition-colors hover:border-brand/50 hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-1"
              >
                <span className="rounded-lg bg-brand/15 p-2 text-brand">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold group-hover:text-brand">
                    {item.title}
                  </span>
                  <span className="block text-sm leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col items-start gap-2">
              <SectionHeading
                title="Document Issuances Over Time"
                description="Monthly issuance volume"
              />
            </div>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3 border-b px-1 sm:gap-5">
            {months.map((item) => (
              <div
                key={item.month}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.count}
                </span>
                <div
                  className="w-full max-w-12 rounded-t-md bg-brand/80 transition-all"
                  style={{ height: `${(item.count / maxMonthly) * 72}%` }}
                />
                <span className="pb-2 text-xs text-muted-foreground">
                  {monthLabel(item.month)}
                </span>
              </div>
            ))}
            {months.length === 0 && !dashboardQuery.isLoading ? (
              <p className="w-full self-center text-center text-sm text-muted-foreground">
                No issuance history yet.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Counts documents currently in force by issue date. Voided documents
            are not counted.
          </p>
        </article>

        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start gap-2">
            <SectionHeading
              title="Issuances by Document Type"
              description="Distribution for the selected reporting period"
            />
          </div>
          <div className="mt-5 space-y-4">
            {types.map((item) => (
              <div key={item.code}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {item.count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${totalByType > 0 ? (item.count / totalByType) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {totalByType === 0 && !dashboardQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                No issuance records in this period.
              </p>
            ) : null}
          </div>
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{totalByType}</span>
          </div>
        </article>
      </section>

      <section className="grid gap-4">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start gap-2">
            <SectionHeading
              title="Expiring IDs and Clearances"
              description="Records that may need attention soon"
            />
          </div>
          <div className="mt-4 divide-y">
            {expiring.map((item) => (
              <div
                key={item.issuance_id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{item.resident_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.kind === "clearance"
                      ? "Barangay Clearance"
                      : "Barangay ID"}{" "}
                    · {item.reference_no} · Expiry date:{" "}
                    {dateLabel(item.expires_on)}
                  </p>
                </div>
                <span className="inline-flex min-h-8 items-center self-start rounded-full border px-3 text-xs font-semibold sm:self-center">
                  {expiryText(item.days_left)}
                </span>
              </div>
            ))}
            {expiring.length === 0 && !dashboardQuery.isLoading ? (
              <p className="py-3 text-sm text-muted-foreground">
                No records are expiring soon.
              </p>
            ) : null}
          </div>
          <Link
            to="/issuances"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
          >
            Open issuance history
          </Link>
        </article>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand/10 p-2.5 text-brand">
            <Activity className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-col items-start gap-2">
              <SectionHeading
                title="Recent Activities"
                description={
                  isAdmin
                    ? "Recent system-wide activity"
                    : "Your recent activity"
                }
              />
            </div>
          </div>
        </div>
        <div className="mt-4 divide-y">
          {activities.map((activity) => {
            const reference =
              typeof activity.details?.reference_no === "string"
                ? activity.details.reference_no
                : null
            const who = isAdmin
              ? activity.is_own
                ? "You"
                : (activity.actor_email ?? "Deleted account")
              : null
            const detail =
              [who, reference].filter(Boolean).join(" · ") ||
              (activity.module ?? "")
            return (
              <div
                key={activity.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {activityTitle(activity.action)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeFormat.format(new Date(activity.occurred_at))}
                </span>
              </div>
            )
          })}
          {activityQuery.isError ? (
            <p className="py-3 text-sm text-muted-foreground">
              Recent activity could not be loaded.
            </p>
          ) : null}
          {activities.length === 0 &&
          !activityQuery.isLoading &&
          !activityQuery.isError ? (
            <p className="py-3 text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Activity history appears here as actions are recorded.
        </p>
      </section>
    </div>
  )
}
