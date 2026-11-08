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
  const maxMonthly = Math.max(1, ...months.map((item) => item.count))
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
        <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col items-start gap-2">
              <SectionHeading
                title={t("dashboard.overTime.title")}
                description={t("dashboard.overTime.description")}
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
                {t("dashboard.overTime.empty")}
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
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
