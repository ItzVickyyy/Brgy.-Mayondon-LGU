import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Activity,
  BarChart3,
  CalendarDays,
  Clock3,
  FileCheck2,
  IdCard,
  Users,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ActivityService, DashboardService } from "@/client"
import { ErrorState, LoadingState } from "@/components/Common/FeedbackState"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { activityTitle } from "@/lib/activity"
import { documentTypeLabel } from "@/lib/issuanceLabels"
import { formatLocaleDate, formatLocaleNumber } from "@/lib/locale"

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

const periods: Period[] = [
  "today",
  "week",
  "month",
  "3months",
  "6months",
  "year",
  "overall",
]

// "2026-11" -> "Nov 26"; the year is two digits so a long range still fits.
function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number)
  const name = formatLocaleDate(new Date(year, month - 1, 1), { month: "short" })
  return `${name} ${String(year).slice(-2)}`
}

// "2026-12-06" is a business date, not a moment: format it without time zones.
function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return formatLocaleDate(new Date(year, month - 1, day), {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

// Round the chart's top value up to a "nice" number and build the y-axis ticks
// (0, step, 2*step, ...) so gridlines land on readable whole counts.
function niceScale(max: number) {
  const rough = Math.max(1, max) / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const unit = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  const step = Math.max(1, unit * power)
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let value = 0; value <= top; value += step) ticks.push(value)
  return { top, ticks }
}

function OverTimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/40 px-3 py-2.5">
      <p className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums leading-6">
        {value}
      </p>
    </div>
  )
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
  const { t } = useTranslation()
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
      (
        await ActivityService.listActivity({
          query: { limit: 5, exclude_module: "auth" },
        })
      ).data,
  })
  const dashboard = dashboardQuery.data
  const summary = dashboard?.summary
  const months = dashboard?.issuances_over_time ?? []
  const maxMonthly = Math.max(0, ...months.map((item) => item.count))
  const { top: chartTop, ticks: chartTicks } = niceScale(maxMonthly)
  const monthsTotal = months.reduce((sum, item) => sum + item.count, 0)
  const monthsAverage = months.length > 0 ? monthsTotal / months.length : 0
  const peakMonth = months.reduce<(typeof months)[number] | null>(
    (best, item) => (best === null || item.count > best.count ? item : best),
    null,
  )
  const hasOverTimeData = months.length > 0 && monthsTotal > 0
  const types = dashboard?.by_document_type ?? []
  const totalByType = dashboard?.total_issued ?? 0
  const expiring = dashboard?.expiring ?? []
  const activities = activityQuery.data?.data ?? []
  const number = (value: number | undefined) =>
    value === undefined ? "–" : formatLocaleNumber(value)
  const expiryText = (daysLeft: number) =>
    daysLeft <= 0
      ? t("dashboard.expiring.today")
      : t("dashboard.expiring.inDays", { count: daysLeft })
  const quickActions = [
    {
      key: "findResident",
      title: t("dashboard.quickActions.findResident.title"),
      description: t("dashboard.quickActions.findResident.description"),
      to: "/records",
      icon: Users,
    },
    {
      key: "createIssuance",
      title: t("dashboard.quickActions.createIssuance.title"),
      description: t("dashboard.quickActions.createIssuance.description"),
      to: "/issuances",
      icon: FileCheck2,
    },
    {
      key: "reviewHistory",
      title: t("dashboard.quickActions.reviewHistory.title"),
      description: t("dashboard.quickActions.reviewHistory.description"),
      to: "/issuances",
      icon: CalendarDays,
    },
    {
      key: "viewActivity",
      title: t("dashboard.quickActions.viewActivity.title"),
      description: t("dashboard.quickActions.viewActivity.description"),
      to: "/activity-log",
      icon: Activity,
    },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("dashboard.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <label className="flex items-center gap-2 self-start text-sm sm:self-auto">
          <CalendarDays
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            {t("dashboard.period.label")}
          </span>
          <select
            aria-label={t("dashboard.period.ariaLabel")}
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="min-h-11 rounded-md border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {periods.map((value) => (
              <option key={value} value={value}>
                {t(`dashboard.period.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dashboardQuery.isLoading ? (
        <LoadingState title={t("dashboard.loading")} />
      ) : null}
      {dashboardQuery.isError ? (
        <ErrorState
          title={t("dashboard.loadError.title")}
          description={t("dashboard.loadError.description")}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}

      <section
        aria-label={t("dashboard.summary.ariaLabel")}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          title={t("dashboard.summary.issuedThisMonth.title")}
          value={number(summary?.documents_issued_this_month)}
          description={t("dashboard.summary.issuedThisMonth.description")}
          icon={FileCheck2}
        />
        <SummaryCard
          title={t("dashboard.summary.clearancesExpiring.title")}
          value={number(summary?.clearances_expiring)}
          description={t("dashboard.summary.clearancesExpiring.description", {
            days: summary?.clearance_window_days ?? 30,
          })}
          icon={Clock3}
        />
        <SummaryCard
          title={t("dashboard.summary.idsExpiring.title")}
          value={number(summary?.barangay_ids_expiring)}
          description={t("dashboard.summary.idsExpiring.description", {
            days: summary?.id_window_days ?? 30,
          })}
          icon={IdCard}
        />
        <SummaryCard
          title={t("dashboard.summary.pending.title")}
          value={number(summary?.open_drafts)}
          description={t("dashboard.summary.pending.description")}
          icon={Users}
        />
      </section>

      <section aria-label={t("dashboard.quickActions.ariaLabel")}>
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title={t("dashboard.quickActions.title")} />
          <div className="mt-3 flex flex-col gap-3 lg:flex-row">
            {quickActions.map((item) => (
              <Link
                key={item.key}
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
        <article className="flex flex-col rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="hidden rounded-lg bg-brand/10 p-2.5 text-brand sm:block">
              <BarChart3 className="size-5" aria-hidden="true" />
            </div>
            <SectionHeading
              title={t("dashboard.overTime.title")}
              description={t("dashboard.overTime.description")}
            />
          </div>

          {hasOverTimeData && peakMonth ? (
            <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <OverTimeStat
                label={t("dashboard.overTime.stats.total")}
                value={formatLocaleNumber(monthsTotal)}
              />
              <OverTimeStat
                label={t("dashboard.overTime.stats.average")}
                value={formatLocaleNumber(monthsAverage, {
                  maximumFractionDigits: 1,
                })}
              />
              <OverTimeStat
                label={t("dashboard.overTime.stats.peak")}
                value={`${monthLabel(peakMonth.month)} · ${formatLocaleNumber(peakMonth.count)}`}
              />
            </dl>
          ) : null}

          {months.length > 0 ? (
            <>
              {/* The chart grows to fill the card, so a taller neighbour in the
                  grid never leaves empty space above the footnote. */}
              <div className="mt-5 flex flex-1 gap-2">
                {/* y-axis labels; pb-7 matches the month-label row below the plot */}
                <div
                  className="flex w-8 shrink-0 flex-col pt-6 pb-7"
                  aria-hidden="true"
                >
                  <div className="relative flex-1">
                    {chartTicks.map((tick) => (
                      <span
                        key={tick}
                        className="absolute right-0 translate-y-1/2 text-[11px] tabular-nums leading-none text-muted-foreground"
                        style={{ bottom: `${(tick / chartTop) * 100}%` }}
                      >
                        {formatLocaleNumber(tick)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* plot area: scrolls sideways when the range is long */}
                <div
                  className="flex min-w-0 flex-1 flex-col overflow-x-auto pb-1"
                  aria-hidden="true"
                >
                  <div
                    className="flex flex-1 flex-col"
                    style={{ minWidth: `${months.length * 44}px` }}
                  >
                    <div className="relative min-h-[14.5rem] flex-1">
                      <div className="absolute inset-x-0 top-6 bottom-0">
                        {chartTicks.map((tick) => (
                          <div
                            key={tick}
                            className={`absolute inset-x-0 border-t ${tick === 0 ? "border-border" : "border-dashed border-border/70"}`}
                            style={{ bottom: `${(tick / chartTop) * 100}%` }}
                          />
                        ))}
                        <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
                          {months.map((item) => {
                            const isPeak =
                              peakMonth !== null &&
                              item.month === peakMonth.month &&
                              item.count > 0
                            return (
                              <div
                                key={item.month}
                                title={`${monthLabel(item.month)}: ${formatLocaleNumber(item.count)}`}
                                className="group relative flex h-full flex-1 items-end justify-center"
                              >
                                <div
                                  className={`relative w-full max-w-10 rounded-t-md transition-colors ${isPeak ? "bg-brand" : "bg-brand/50 group-hover:bg-brand/80"}`}
                                  style={{
                                    height: `${(item.count / chartTop) * 100}%`,
                                    minHeight: item.count > 0 ? "4px" : "0",
                                  }}
                                >
                                  <span
                                    className={`absolute -top-5 left-1/2 -translate-x-1/2 text-xs tabular-nums ${isPeak ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                                  >
                                    {formatLocaleNumber(item.count)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 sm:gap-3">
                      {months.map((item) => (
                        <span
                          key={item.month}
                          className="flex-1 truncate text-center text-xs text-muted-foreground"
                        >
                          {monthLabel(item.month)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* The chart above is visual only; this table carries the same data. */}
              <table className="sr-only">
                <caption>{t("dashboard.overTime.title")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("dashboard.overTime.table.month")}</th>
                    <th scope="col">{t("dashboard.overTime.table.count")}</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((item) => (
                    <tr key={item.month}>
                      <th scope="row">{monthLabel(item.month)}</th>
                      <td>{formatLocaleNumber(item.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {months.length === 0 && !dashboardQuery.isLoading ? (
            <div className="mt-5 flex min-h-52 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
              <BarChart3
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                {t("dashboard.overTime.empty")}
              </p>
            </div>
          ) : null}

          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            {t("dashboard.overTime.note")}
          </p>
        </article>

        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start gap-2">
            <SectionHeading
              title={t("dashboard.byType.title")}
              description={t("dashboard.byType.description")}
            />
          </div>
          <div className="mt-5 space-y-4">
            {types.map((item) => (
              <div key={item.code}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {documentTypeLabel(item.code, item.name, t)}
                  </span>
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
                {t("dashboard.byType.empty")}
              </p>
            ) : null}
          </div>
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">
              {t("dashboard.byType.total")}
            </span>
            <span className="font-semibold tabular-nums">{totalByType}</span>
          </div>
        </article>
      </section>

      <section className="grid gap-4">
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start gap-2">
            <SectionHeading
              title={t("dashboard.expiring.title")}
              description={t("dashboard.expiring.description")}
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
                    {t("dashboard.expiring.line", {
                      kind:
                        item.kind === "clearance"
                          ? t("dashboard.expiring.clearance")
                          : t("dashboard.expiring.id"),
                      reference: item.reference_no,
                      date: dateLabel(item.expires_on),
                    })}
                  </p>
                </div>
                <span className="inline-flex min-h-8 items-center self-start rounded-full border px-3 text-xs font-semibold sm:self-center">
                  {expiryText(item.days_left)}
                </span>
              </div>
            ))}
            {expiring.length === 0 && !dashboardQuery.isLoading ? (
              <p className="py-3 text-sm text-muted-foreground">
                {t("dashboard.expiring.empty")}
              </p>
            ) : null}
          </div>
          <Link
            to="/issuances"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
          >
            {t("dashboard.expiring.openHistory")}
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
                title={t("dashboard.recent.title")}
                description={
                  isAdmin
                    ? t("dashboard.recent.descriptionAdmin")
                    : t("dashboard.recent.descriptionStaff")
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
                ? t("dashboard.recent.you")
                : (activity.actor_email ?? t("dashboard.recent.deletedAccount"))
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
                    {activityTitle(activity.action, t)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatLocaleDate(new Date(activity.occurred_at), {
                    timeZone: "Asia/Manila",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            )
          })}
          {activityQuery.isError ? (
            <p className="py-3 text-sm text-muted-foreground">
              {t("dashboard.recent.loadError")}
            </p>
          ) : null}
          {activities.length === 0 &&
          !activityQuery.isLoading &&
          !activityQuery.isError ? (
            <p className="py-3 text-sm text-muted-foreground">
              {t("dashboard.recent.empty")}
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("dashboard.recent.note")}
        </p>
      </section>
    </div>
  )
}
