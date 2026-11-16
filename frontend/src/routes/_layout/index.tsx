import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileCheck2,
  IdCard,
  Plus,
  Users,
  Zap,
} from "lucide-react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ActivityService, DashboardService } from "@/client"
import { AnimatedNumber } from "@/components/Common/AnimatedNumber"
import { ErrorState, LoadingState } from "@/components/Common/FeedbackState"
import { Select } from "@/components/Common/Select"
import { Skeleton } from "@/components/ui/skeleton"
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

// "2026-11" -> "Nov". The year is shown once in the chart heading; pass
// withYear for places that must stay unambiguous (tooltips, screen readers).
function monthLabel(value: string, withYear = false) {
  const [year, month] = value.split("-").map(Number)
  const name = formatLocaleDate(new Date(year, month - 1, 1), {
    month: "short",
  })
  return withYear ? `${name} ${year}` : name
}

// "2026", or "2025 – 2026" when the range crosses a year.
function yearRange(values: string[]) {
  if (values.length === 0) return ""
  const first = values[0].slice(0, 4)
  const last = values[values.length - 1].slice(0, 4)
  return first === last ? first : `${first} – ${last}`
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

// Closer to expiry means louder: red inside a week, amber inside two.
function expiryPillClass(daysLeft: number) {
  if (daysLeft <= 7)
    return "border-red-300 bg-red-100 text-red-900 dark:border-red-500/50 dark:bg-red-950 dark:text-red-100"
  if (daysLeft <= 14)
    return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950 dark:text-amber-100"
  return "border-border bg-muted text-foreground"
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

// Each summary card has its own color so the four can be told apart at a glance.
const summaryTones = {
  green: {
    bar: "border-t-emerald-600",
    chip: "bg-emerald-600 text-white",
  },
  amber: {
    bar: "border-t-amber-500",
    chip: "bg-amber-500 text-amber-950",
  },
  orange: {
    bar: "border-t-orange-600",
    chip: "bg-orange-600 text-white",
  },
  sky: {
    bar: "border-t-sky-600",
    chip: "bg-sky-600 text-white",
  },
} as const

function SummaryCard({
  title,
  value,
  loading,
  description,
  icon: Icon,
  tone,
}: {
  title: string
  value: number | undefined
  loading: boolean
  description: string
  icon: typeof Users
  tone: keyof typeof summaryTones
}) {
  const colors = summaryTones[tone]
  return (
    <article
      className={`rounded-xl border border-t-4 bg-card p-4 shadow-md sm:p-5 ${colors.bar}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
            {value !== undefined ? (
              <AnimatedNumber value={value} />
            ) : loading ? (
              <Skeleton className="h-10 w-16" />
            ) : (
              "–"
            )}
          </p>
        </div>
        <div className={`rounded-lg p-3 shadow-sm ${colors.chip}`}>
          <Icon className="size-6" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {description}
      </p>
    </article>
  )
}

// Placeholders that keep the shape of each card while the numbers load.
function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          // Identical placeholders; their order never changes.
          key={index}
          className="flex items-center justify-between gap-4 py-3"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0" />
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  const heights = ["h-1/3", "h-1/2", "h-2/3", "h-2/5", "h-3/4", "h-1/2"]
  return (
    <div
      className="mt-5 flex min-h-[14.5rem] flex-1 items-end gap-3 border-b px-2 pt-6"
      aria-hidden="true"
    >
      {heights.map((height, index) => (
        <Skeleton key={index} className={`w-full max-w-10 ${height}`} />
      ))}
    </div>
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
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

// A card with a tinted header band, so every block on the page starts with a
// clear, bold title instead of floating on the same white.
function Panel({
  icon: Icon,
  title,
  description,
  aside,
  className = "",
  children,
}: {
  icon: typeof Users
  title: string
  description?: string
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-md ${className}`}
    >
      <header className="flex items-center gap-3 border-b bg-primary/10 px-4 py-3.5 dark:bg-primary/25 sm:px-5">
        <div className="rounded-lg bg-primary p-2 text-primary-foreground shadow-sm">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <SectionHeading title={title} description={description} />
        </div>
        {aside}
      </header>
      <div className="flex flex-1 flex-col p-4 sm:p-5">{children}</div>
    </article>
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
          query: { limit: 5, exclude_module: "auth", hide_reads: true },
        })
      ).data,
  })
  const dashboard = dashboardQuery.data
  const summary = dashboard?.summary
  const months = dashboard?.issuances_over_time ?? []
  // Overall can reach back many years. Past two years of months the bars would
  // be a long scroll, so each bar becomes one year (the current year is counted
  // up to today). Shorter ranges and every other period stay monthly.
  const byYear = period === "overall" && months.length > 24
  const bars = byYear
    ? Object.values(
        months.reduce<Record<string, { key: string; count: number }>>(
          (acc, item) => {
            const year = item.month.slice(0, 4)
            acc[year] = {
              key: year,
              count: (acc[year]?.count ?? 0) + item.count,
            }
            return acc
          },
          {},
        ),
      ).map((item) => ({ ...item, label: item.key, fullLabel: item.key }))
    : months.map((item) => ({
        key: item.month,
        count: item.count,
        label: monthLabel(item.month),
        fullLabel: monthLabel(item.month, true),
      }))
  const maxMonthly = Math.max(0, ...bars.map((item) => item.count))
  const { top: chartTop, ticks: chartTicks } = niceScale(maxMonthly)
  const monthsTotal = bars.reduce((sum, item) => sum + item.count, 0)
  const monthsAverage = bars.length > 0 ? monthsTotal / bars.length : 0
  const peakMonth = bars.reduce<(typeof bars)[number] | null>(
    (best, item) => (best === null || item.count > best.count ? item : best),
    null,
  )
  const chartYears = yearRange(months.map((item) => item.month))
  // A long range scrolls sideways inside the card; start at the newest bar.
  const plotScroller = useRef<HTMLDivElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: run again when the range changes
  useEffect(() => {
    const box = plotScroller.current
    if (box) box.scrollLeft = box.scrollWidth
  }, [bars.length, period])
  const hasOverTimeData = bars.length > 0 && monthsTotal > 0
  const types = dashboard?.by_document_type ?? []
  const totalByType = dashboard?.total_issued ?? 0
  const expiring = dashboard?.expiring ?? []
  const expiringTotal =
    (summary?.clearances_expiring ?? 0) + (summary?.barangay_ids_expiring ?? 0)
  const activities = activityQuery.data?.data ?? []
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
      chip: "bg-sky-600 text-white",
    },
    {
      key: "createIssuance",
      title: t("dashboard.quickActions.createIssuance.title"),
      description: t("dashboard.quickActions.createIssuance.description"),
      to: "/issuances",
      icon: FileCheck2,
      chip: "bg-emerald-600 text-white",
    },
    {
      key: "reviewHistory",
      title: t("dashboard.quickActions.reviewHistory.title"),
      description: t("dashboard.quickActions.reviewHistory.description"),
      to: "/issuances",
      icon: CalendarDays,
      chip: "bg-violet-600 text-white",
    },
    {
      key: "viewActivity",
      title: t("dashboard.quickActions.viewActivity.title"),
      description: t("dashboard.quickActions.viewActivity.description"),
      to: "/activity-log",
      icon: Activity,
      chip: "bg-orange-600 text-white",
    },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("dashboard.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <label
          htmlFor="dashboard-period"
          className="flex items-center gap-2 self-start text-sm sm:self-auto"
        >
          <CalendarDays
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            {t("dashboard.period.label")}
          </span>
          <Select
            id="dashboard-period"
            aria-label={t("dashboard.period.ariaLabel")}
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="min-h-11 min-w-40 rounded-md border bg-background px-3 text-base transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {periods.map((value) => (
              <option key={value} value={value}>
                {t(`dashboard.period.${value}`)}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <section
        aria-label={t("dashboard.cta.ariaLabel")}
        className="relative overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-lg"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 right-28 size-48 rounded-full bg-white/10"
        />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              {t("dashboard.cta.title")}
            </h2>
            <p className="mt-1 text-sm text-primary-foreground/85">
              {t("dashboard.cta.description")}
            </p>
          </div>
          <a
            href="/issuances?new=1"
            data-testid="create-issuance-cta"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 text-base font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <Plus className="size-5" aria-hidden="true" />
            {t("dashboard.cta.button")}
          </a>
        </div>
      </section>

      {dashboardQuery.isLoading ? (
        <LoadingState title={t("dashboard.loading")} lines={0} />
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
        className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
      >
        <SummaryCard
          title={t("dashboard.summary.issuedThisMonth.title")}
          value={summary?.documents_issued_this_month}
          loading={dashboardQuery.isLoading}
          description={t("dashboard.summary.issuedThisMonth.description")}
          icon={FileCheck2}
          tone="green"
        />
        <SummaryCard
          title={t("dashboard.summary.clearancesExpiring.title")}
          value={summary?.clearances_expiring}
          loading={dashboardQuery.isLoading}
          description={t("dashboard.summary.clearancesExpiring.description", {
            days: summary?.clearance_window_days ?? 30,
          })}
          icon={Clock3}
          tone="amber"
        />
        <SummaryCard
          title={t("dashboard.summary.idsExpiring.title")}
          value={summary?.barangay_ids_expiring}
          loading={dashboardQuery.isLoading}
          description={t("dashboard.summary.idsExpiring.description", {
            days: summary?.id_window_days ?? 30,
          })}
          icon={IdCard}
          tone="orange"
        />
        <SummaryCard
          title={t("dashboard.summary.pending.title")}
          value={summary?.open_drafts}
          loading={dashboardQuery.isLoading}
          description={t("dashboard.summary.pending.description")}
          icon={Users}
          tone="sky"
        />
      </section>

      <section aria-label={t("dashboard.quickActions.ariaLabel")}>
        <Panel icon={Zap} title={t("dashboard.quickActions.title")}>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {quickActions.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className="action-card group flex min-h-20 items-center gap-3 rounded-xl border-2 bg-card px-3.5 py-3 shadow-md"
              >
                <span className={`rounded-xl p-3 shadow-sm ${item.chip}`}>
                  <item.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="action-title block text-base font-bold leading-5">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  className="action-arrow size-6 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      {/* minmax(0, ...) and min-w-0: a 24-month chart must scroll inside its
            card instead of stretching the grid column and the page. */}
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          icon={BarChart3}
          title={t("dashboard.overTime.title")}
          description={t(
            byYear
              ? "dashboard.overTime.descriptionYear"
              : "dashboard.overTime.description",
          )}
          aside={
            chartYears ? (
              <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm font-bold tabular-nums text-primary-foreground">
                {chartYears}
              </span>
            ) : null
          }
        >
          {hasOverTimeData && peakMonth ? (
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <OverTimeStat
                label={t("dashboard.overTime.stats.total")}
                value={formatLocaleNumber(monthsTotal)}
              />
              <OverTimeStat
                label={t(
                  byYear
                    ? "dashboard.overTime.stats.averageYear"
                    : "dashboard.overTime.stats.average",
                )}
                value={formatLocaleNumber(monthsAverage, {
                  maximumFractionDigits: 1,
                })}
              />
              <OverTimeStat
                label={t(
                  byYear
                    ? "dashboard.overTime.stats.peakYear"
                    : "dashboard.overTime.stats.peak",
                )}
                value={`${peakMonth.fullLabel} · ${formatLocaleNumber(peakMonth.count)}`}
              />
            </dl>
          ) : null}

          {dashboardQuery.isLoading ? <ChartSkeleton /> : null}

          {bars.length > 0 ? (
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
                  ref={plotScroller}
                  className="flex min-w-0 flex-1 flex-col overflow-x-auto pb-1"
                  aria-hidden="true"
                >
                  <div
                    className="flex flex-1 flex-col"
                    style={{ minWidth: `${bars.length * 40}px` }}
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
                          {bars.map((item, index) => (
                            <div
                              key={`${period}-${item.key}`}
                              title={`${item.fullLabel}: ${formatLocaleNumber(item.count)}`}
                              className="group relative flex h-full flex-1 items-end justify-center"
                            >
                              {/* Solid by default; softer on hover. The bar rises
                                  from the bottom, one after another. */}
                              <div
                                className="bar-rise relative w-full max-w-10 rounded-t-md bg-brand transition-colors group-hover:bg-brand/60"
                                style={
                                  {
                                    height: `${(item.count / chartTop) * 100}%`,
                                    minHeight: item.count > 0 ? "4px" : "0",
                                    "--bar-delay": `${index * 60}ms`,
                                  } as CSSProperties
                                }
                              >
                                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs tabular-nums text-muted-foreground transition-colors group-hover:text-foreground">
                                  {formatLocaleNumber(item.count)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 sm:gap-3">
                      {bars.map((item) => (
                        <span
                          key={item.key}
                          className="flex-1 truncate text-center text-xs text-muted-foreground"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* The chart above is visual only; this table carries the same data.
                  A table ignores the 1px width of sr-only and stretched the page
                  sideways in Filipino, so the clipping box is a div around it. */}
              <div className="sr-only">
                <table>
                  <caption>{t("dashboard.overTime.title")}</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        {t(
                          byYear
                            ? "dashboard.overTime.table.year"
                            : "dashboard.overTime.table.month",
                        )}
                      </th>
                      <th scope="col">{t("dashboard.overTime.table.count")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bars.map((item) => (
                      <tr key={item.key}>
                        <th scope="row">{item.fullLabel}</th>
                        <td>{formatLocaleNumber(item.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {bars.length === 0 && !dashboardQuery.isLoading ? (
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
            {byYear ? ` ${t("dashboard.overTime.noteYear")}` : ""}
          </p>
        </Panel>

        <Panel
          icon={FileCheck2}
          title={t("dashboard.byType.title")}
          description={t("dashboard.byType.description")}
        >
          <div className="space-y-4">
            {dashboardQuery.isLoading
              ? Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="space-y-2" aria-hidden="true">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))
              : null}
            {types.map((item, index) => (
              <div key={`${period}-${item.code}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {documentTypeLabel(item.code, item.name, t)}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <AnimatedNumber value={item.count} />
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="bar-grow h-full rounded-full bg-brand"
                    style={
                      {
                        width: `${totalByType > 0 ? (item.count / totalByType) * 100 : 0}%`,
                        "--bar-delay": `${index * 80}ms`,
                      } as CSSProperties
                    }
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
            <span className="text-lg font-extrabold tabular-nums">
              <AnimatedNumber value={totalByType} />
            </span>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4">
        <Panel
          icon={Clock3}
          title={t("dashboard.expiring.title")}
          description={t("dashboard.expiring.description")}
        >
          {dashboardQuery.isLoading ? (
            <div>
              <RowsSkeleton />
            </div>
          ) : null}
          <div className="divide-y">
            {expiring.map((item) => (
              <div
                key={item.issuance_id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{item.resident_name}</p>
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
                <span
                  className={`inline-flex min-h-8 items-center self-start rounded-full border px-3 text-xs font-bold sm:self-center ${expiryPillClass(item.days_left)}`}
                >
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
          {expiringTotal > expiring.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("dashboard.expiring.showing", {
                shown: expiring.length,
                total: formatLocaleNumber(expiringTotal),
              })}
            </p>
          ) : null}
          <Link
            to="/issuances"
            className="mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-lg border-2 border-primary px-4 font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground dark:border-brand dark:text-brand dark:hover:bg-brand dark:hover:text-background"
          >
            {t("dashboard.expiring.openHistory")}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </Panel>
      </section>

      <Panel
        icon={Activity}
        title={t("dashboard.recent.title")}
        description={
          isAdmin
            ? t("dashboard.recent.descriptionAdmin")
            : t("dashboard.recent.descriptionStaff")
        }
      >
        {activityQuery.isLoading ? (
          <div>
            <RowsSkeleton rows={4} />
          </div>
        ) : null}
        <div className="divide-y">
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
                  <p className="text-sm font-semibold">
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
      </Panel>
    </div>
  )
}
