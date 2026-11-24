import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  Activity,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileCheck2,
  IdCard,
  Plus,
  Users,
} from "lucide-react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ActivityService, DashboardService } from "@/client"
import { AnimatedNumber } from "@/components/Common/AnimatedNumber"
import { ErrorState, LoadingState } from "@/components/Common/FeedbackState"
import { Select } from "@/components/Common/Select"
import { PopulationOverview } from "@/components/Dashboard/PopulationOverview"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { activityTitle } from "@/lib/activity"
import { documentTypeLabel } from "@/lib/issuanceLabels"
import { formatLocaleDate, formatLocaleNumber } from "@/lib/locale"
import { queryClient } from "@/lib/queryClient"
import { statCycle, statTones } from "@/lib/statTones"

// Shared by the page and by the route loader below, so the loader's early request is the very
// request the page then uses (patch 237).
const dashboardQueryOptions = (period: Period) => ({
  queryKey: ["dashboard", period] as const,
  queryFn: async () =>
    (await DashboardService.dashboard({ query: { period } })).data,
})

const dashboardActivityQueryOptions = {
  queryKey: ["dashboard-activity"] as const,
  queryFn: async () =>
    (
      await ActivityService.listActivity({
        query: { limit: 5, exclude_module: "auth", hide_reads: true },
      })
    ).data,
}

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  // Start the two dashboard requests with the page code instead of after the page has drawn.
  // Not awaited: the page shows its skeletons at once and fills in when the answers arrive, and a
  // failed request is reported by the page's own queries, not here.
  loader: () => {
    void queryClient.prefetchQuery(dashboardQueryOptions("year"))
    void queryClient.prefetchQuery(dashboardActivityQueryOptions)
  },
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

// "2026-11-22" -> "Sun" (short) or "Sun, Nov 22" (full; the week is always the
// current one, so the year is left out to keep the "Busiest day" tile short).
function dayLabel(value: string, full = false) {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return full
    ? formatLocaleDate(date, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : formatLocaleDate(date, { weekday: "short" })
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
      <p className="truncate text-xs font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="stat-figure mt-1.5 truncate text-2xl">{value}</p>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  loading,
  description,
  icon: Icon,
}: {
  title: string
  value: number | undefined
  loading: boolean
  description: string
  icon: typeof Users
}) {
  return (
    <article className="card-hover rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="stat-label">{title}</p>
          <p className="stat-figure mt-3 text-3xl 2xl:text-4xl">
            {value !== undefined ? (
              <AnimatedNumber value={value} />
            ) : loading ? (
              <Skeleton className="h-8 w-16 2xl:h-9" />
            ) : (
              "–"
            )}
          </p>
        </div>
        <div className="rounded-md bg-brand/10 p-2.5 text-brand">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
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
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>("year")
  const dashboardQuery = useQuery({
    ...dashboardQueryOptions(period),
    // Keep the old figures on screen while the new period loads, so the page
    // does not collapse to skeletons and jump (and lose its scrollbar).
    placeholderData: keepPreviousData,
  })
  // Staff always get only their own rows from this endpoint; Admin gets everyone's.
  const activityQuery = useQuery(dashboardActivityQueryOptions)
  const dashboard = dashboardQuery.data
  const summary = dashboard?.summary
  const months = dashboard?.issuances_over_time ?? []
  // Overall can reach back many years. Past two years of months the bars would
  // be a long scroll, so each bar becomes one year (the current year is counted
  // up to today). Shorter ranges and every other period stay monthly.
  const byYear = period === "overall" && months.length > 24
  // This Week: one bar per day, Sunday to Saturday (sent by the API).
  const byDay = period === "week"
  const days = dashboard?.issuances_by_day ?? []
  const bars = byDay
    ? days.map((item) => ({
        key: item.day,
        count: item.count,
        label: dayLabel(item.day),
        fullLabel: dayLabel(item.day, true),
      }))
    : byYear
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
      key: "createIssuance",
      title: t("dashboard.quickActions.createIssuance.title"),
      description: t("dashboard.quickActions.createIssuance.description"),
      to: "/issuances",
      icon: FileCheck2,
    },
    {
      key: "findResident",
      title: t("dashboard.quickActions.findResident.title"),
      description: t("dashboard.quickActions.findResident.description"),
      to: "/records",
      icon: Users,
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
    <div className="stagger-in flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("dashboard.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Call to action: opens Issuances with the New Issuance dialog ready. */}
          <Button
            type="button"
            variant="cta"
            size="cta"
            className="icon-react icon-spin w-full sm:w-auto"
            onClick={() =>
              void navigate({ to: "/issuances", search: { new: 1 } })
            }
          >
            <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
            {t("dashboard.issueDocument")}
          </Button>
        </div>
      </div>

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
        />
        <SummaryCard
          title={t("dashboard.summary.clearancesExpiring.title")}
          value={summary?.clearances_expiring}
          loading={dashboardQuery.isLoading}
          description={t("dashboard.summary.clearancesExpiring.description", {
            days: summary?.clearance_window_days ?? 30,
          })}
          icon={Clock3}
        />
        <SummaryCard
          title={t("dashboard.summary.idsExpiring.title")}
          value={summary?.barangay_ids_expiring}
          loading={dashboardQuery.isLoading}
          description={t("dashboard.summary.idsExpiring.description", {
            days: summary?.id_window_days ?? 30,
          })}
          icon={IdCard}
        />
        <SummaryCard
          title={t("dashboard.summary.pending.title")}
          value={summary?.open_drafts}
          loading={dashboardQuery.isLoading}
          description={t("dashboard.summary.pending.description")}
          icon={Users}
        />
      </section>

      <section aria-label={t("dashboard.quickActions.ariaLabel")}>
        <article className="card-hover rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <SectionHeading title={t("dashboard.quickActions.title")} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {quickActions.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className="action-card group flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2"
              >
                <span className="action-chip rounded-md p-1.5">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="action-title block font-semibold leading-5">
                    {item.title}
                  </span>
                  <span className="action-desc block text-sm leading-5">
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  className="action-arrow size-5 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </article>
      </section>

      {/* minmax(0, ...) and min-w-0: a 24-month chart must scroll inside its
            card instead of stretching the grid column and the page. */}
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <article className="flex min-w-0 flex-col card-hover rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="hidden rounded-lg bg-brand/10 p-2.5 text-brand sm:block">
              <BarChart3 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <SectionHeading
                title={t("dashboard.overTime.title")}
                description={t(
                  byDay
                    ? "dashboard.overTime.descriptionWeek"
                    : byYear
                      ? "dashboard.overTime.descriptionYear"
                      : "dashboard.overTime.description",
                )}
              />
            </div>
            <label
              htmlFor="dashboard-period"
              className="flex shrink-0 items-center gap-2 self-start text-sm"
            >
              <CalendarDays
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {/* The word is shown only on very wide screens; the chart card
                  is narrow, and the icon and the select's own label say the
                  rest. Kept for screen readers at every width. */}
              <span className="sr-only text-muted-foreground 2xl:not-sr-only">
                {t("dashboard.period.label")}
              </span>
              <Select
                id="dashboard-period"
                aria-label={t("dashboard.period.ariaLabel")}
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
                className="min-h-11 min-w-32 rounded-md border bg-background px-3 text-sm transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {periods.map((value) => (
                  <option key={value} value={value}>
                    {t(`dashboard.period.${value}`)}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {hasOverTimeData && peakMonth ? (
            <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <OverTimeStat
                label={t("dashboard.overTime.stats.total")}
                value={formatLocaleNumber(monthsTotal)}
              />
              <OverTimeStat
                label={t(
                  byDay
                    ? "dashboard.overTime.stats.averageWeek"
                    : byYear
                      ? "dashboard.overTime.stats.averageYear"
                      : "dashboard.overTime.stats.average",
                )}
                value={formatLocaleNumber(monthsAverage, {
                  maximumFractionDigits: 1,
                })}
              />
              <OverTimeStat
                label={t(
                  byDay
                    ? "dashboard.overTime.stats.peakWeek"
                    : byYear
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
                        className="absolute right-0 translate-y-1/2 text-xs tabular-nums leading-none text-muted-foreground"
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
                              {/* One soft stat color per bar (same cycle as the
                                  age bars); softer on hover. The bar rises from
                                  the bottom, one after another. */}
                              <div
                                className={`bar-rise relative w-full max-w-10 rounded-t-md transition-opacity group-hover:opacity-70 ${statTones[statCycle[index % statCycle.length]].bg}`}
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
                          byDay
                            ? "dashboard.overTime.table.day"
                            : byYear
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
        </article>

        <article className="min-w-0 card-hover rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start gap-2">
            <SectionHeading
              title={t("dashboard.byType.title")}
              description={t("dashboard.byType.description")}
            />
          </div>
          <div className="mt-5 space-y-4">
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
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`bar-grow h-full rounded-full ${statTones[statCycle[index % statCycle.length]].bg}`}
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
            <span className="font-semibold tabular-nums">
              <AnimatedNumber value={totalByType} />
            </span>
          </div>
        </article>
      </section>

      <PopulationOverview
        data={dashboard?.population}
        loading={dashboardQuery.isLoading}
      />

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <article className="min-w-0 card-hover rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand/10 p-2.5 text-brand">
              <CalendarClock className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col items-start gap-2">
              <SectionHeading
                title={t("dashboard.expiring.title")}
                description={t("dashboard.expiring.description")}
              />
            </div>
          </div>
          {dashboardQuery.isLoading ? (
            <div className="mt-4">
              <RowsSkeleton />
            </div>
          ) : null}
          <div className="mt-4 divide-y">
            {expiring.map((item) => (
              <div
                key={item.issuance_id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{item.resident_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
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
                <span className="inline-flex min-h-8 shrink-0 items-center self-start whitespace-nowrap rounded-full border px-3 text-xs font-semibold sm:self-center">
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
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline"
          >
            {t("dashboard.expiring.openHistory")}
          </Link>
        </article>

        <article className="min-w-0 card-hover rounded-xl border bg-card p-4 shadow-sm sm:p-5">
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
          {activityQuery.isLoading ? (
            <div className="mt-4">
              <RowsSkeleton rows={4} />
            </div>
          ) : null}
          <div className="mt-4 divide-y">
            {activities.map((activity) => {
              const reference =
                typeof activity.details?.reference_no === "string"
                  ? activity.details.reference_no
                  : null
              const who = isAdmin
                ? activity.is_own
                  ? t("dashboard.recent.you")
                  : (activity.actor_email ??
                    t("dashboard.recent.deletedAccount"))
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detail}
                    </p>
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
        </article>
      </section>
    </div>
  )
}
