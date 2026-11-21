import {
  Accessibility,
  Baby,
  ChartPie,
  House,
  MapPin,
  PersonStanding,
  UsersRound,
  VenusAndMars,
  Vote,
} from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { DashboardPopulation } from "@/client"
import { AnimatedNumber } from "@/components/Common/AnimatedNumber"
import { Skeleton } from "@/components/ui/skeleton"
import { formatLocaleNumber } from "@/lib/locale"
import { type StatTone, statCycle, statTones } from "@/lib/statTones"

// Population cards for the Dashboard. Every figure comes from the API (active
// residents only); the page's Period filter does not change them. Colors are
// the system's own: soft stat colors (see lib/statTones.ts), so the cards follow the
// theme and the accent the user picked.

type Segment = { key: string; label: string; value: number; tone: StatTone }

const percent = (part: number, whole: number) =>
  whole > 0 ? (part / whole) * 100 : 0
const fmtPercent = (value: number) =>
  formatLocaleNumber(value, { maximumFractionDigits: 1 })

function CardTitle({
  icon: Icon,
  children,
}: {
  icon: typeof UsersRound
  children: ReactNode
}) {
  return (
    <h3 className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="shrink-0 rounded-md bg-muted p-1.5 text-brand 2xl:p-2">
        <Icon className="size-4 2xl:size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">{children}</span>
    </h3>
  )
}

function StatCard({
  title,
  value,
  growth,
  loading,
  icon: Icon,
  tone,
}: {
  title: string
  value: number | undefined
  growth: number | null | undefined
  loading: boolean
  icon: typeof UsersRound
  tone: StatTone
}) {
  const { t } = useTranslation()
  return (
    <article className="flex min-w-0 flex-col items-stretch gap-2 rounded-xl border bg-card p-3 text-left shadow-sm 2xl:p-4">
      <div className="flex items-center justify-start gap-2">
        <span
          className={`shrink-0 rounded-md bg-muted p-1.5 2xl:p-2 ${statTones[tone].text}`}
        >
          <Icon className="size-4 2xl:size-5" aria-hidden="true" />
        </span>
        <p className="min-w-0 font-semibold leading-tight tracking-tight">
          {title}
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <p className="text-center text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
          {value !== undefined ? (
            <AnimatedNumber value={value} />
          ) : loading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            "–"
          )}
        </p>
        {growth ? (
          <p
            className={`text-center text-xs font-semibold ${statTones[tone].text}`}
          >
            <span
              title={t("dashboard.population.growth", {
                percent: fmtPercent(growth),
              })}
            >
              <span aria-hidden="true">↑ {fmtPercent(growth)}%</span>
              <span className="sr-only">
                {t("dashboard.population.growth", {
                  percent: fmtPercent(growth),
                })}
              </span>
            </span>
          </p>
        ) : null}
      </div>
    </article>
  )
}

// A ring drawn from circles. The centre shows `total` (the population).
function Donut({ segments, total }: { segments: Segment[]; total: number }) {
  const { t } = useTranslation()
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const sum = segments.reduce((acc, item) => acc + item.value, 0)
  let offset = 0
  return (
    <div
      className="relative mx-auto size-28 shrink-0"
      role="img"
      aria-label={segments
        .map((item) => `${item.label}: ${formatLocaleNumber(item.value)}`)
        .join(", ")}
    >
      <svg
        viewBox="0 0 120 120"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="14"
          className="stroke-muted"
        />
        {segments.map((item) => {
          const length = sum > 0 ? (item.value / sum) * circumference : 0
          const circle = (
            <circle
              key={item.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="14"
              stroke="currentColor"
              className={statTones[item.tone].text}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          )
          offset += length
          return length > 0 ? circle : null
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-base font-extrabold leading-5 tabular-nums">
          {formatLocaleNumber(total)}
        </span>
        <span className="text-xs leading-4 text-muted-foreground">
          {t("dashboard.population.chartTotal")}
        </span>
      </div>
    </div>
  )
}

function Legend({
  segments,
  inline = false,
}: {
  segments: Segment[]
  inline?: boolean
}) {
  const sum = segments.reduce((acc, item) => acc + item.value, 0)
  return (
    <ul className={`min-w-0 ${inline ? "space-y-2" : "space-y-2.5"}`}>
      {segments.map((item) => (
        <li
          key={item.key}
          className={`flex gap-2 ${inline ? "items-center" : "items-start"}`}
        >
          <span
            className={`size-2.5 shrink-0 rounded-full bg-current ${inline ? "" : "mt-1"} ${statTones[item.tone].text}`}
            aria-hidden="true"
          />
          {inline ? (
            <span className="flex min-w-0 items-center justify-between gap-4">
              <span className="min-w-0 text-xs leading-4 text-muted-foreground">
                {item.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {fmtPercent(percent(item.value, sum))}%
              </span>
            </span>
          ) : (
            <span className="min-w-0 leading-4">
              <span className="block text-xs text-muted-foreground">
                {item.label}
              </span>
              <span className="block text-sm font-semibold tabular-nums">
                {fmtPercent(percent(item.value, sum))}%
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function SectorTile({
  label,
  value,
  total,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  total: number
  icon: typeof UsersRound
  tone: StatTone
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/40 px-2 py-4 text-center`}
    >
      <Icon className={`size-6 ${statTones[tone].text}`} aria-hidden="true" />
      <p className={`text-xs font-semibold ${statTones[tone].text}`}>{label}</p>
      <p className="text-2xl font-extrabold tabular-nums">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-xs text-muted-foreground">
        {t("dashboard.population.ofPopulation", {
          percent: fmtPercent(percent(value, total)),
        })}
      </p>
    </div>
  )
}

export function PopulationOverview({
  data,
  loading,
}: {
  data: DashboardPopulation | undefined
  loading: boolean
}) {
  const { t } = useTranslation()
  const total = data?.total_population ?? 0
  const ready = data !== undefined

  const gender: Segment[] = [
    {
      key: "male",
      label: t("dashboard.population.male"),
      value: data?.male ?? 0,
      tone: "blue",
    },
    {
      key: "female",
      label: t("dashboard.population.female"),
      value: data?.female ?? 0,
      tone: "rose",
    },
  ]
  const civilTones: StatTone[] = ["blue", "green", "amber", "rose"]
  const civil: Segment[] = (data?.civil_status ?? []).map((item, index) => ({
    key: item.status,
    label: t(`dashboard.population.civil.${item.status}`, {
      defaultValue: item.status,
    }),
    value: item.count,
    tone: civilTones[Math.min(index, civilTones.length - 1)],
  }))
  const ages = data?.age_brackets ?? []
  const maxAge = Math.max(1, ...ages.map((item) => item.count))
  const puroks = data?.by_purok ?? []
  const maxPurok = Math.max(1, ...puroks.map((item) => item.count))
  const sectoral = data?.sectoral

  const card =
    "flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-sm sm:p-5"

  return (
    <section
      aria-label={t("dashboard.population.ariaLabel")}
      className="flex min-w-0 flex-col gap-4"
    >
      {/* Row 1: three number cards, the gender ring and the age bars. */}
      <div className="grid min-w-0 gap-4 sm:grid-cols-6 xl:grid-cols-24">
        <div className="grid min-w-0 gap-4 sm:col-span-6 sm:grid-cols-3 xl:col-span-12">
          <StatCard
            title={t("dashboard.population.totalPopulation")}
            value={data?.total_population}
            growth={data?.population_growth_percent}
            loading={loading}
            icon={UsersRound}
            tone="blue"
          />
          <StatCard
            title={t("dashboard.population.totalHouseholds")}
            value={data?.total_households}
            growth={data?.household_growth_percent}
            loading={loading}
            icon={House}
            tone="green"
          />
          <StatCard
            title={t("dashboard.population.totalVoters")}
            value={data?.total_voters}
            growth={data?.voter_growth_percent}
            loading={loading}
            icon={Vote}
            tone="violet"
          />
        </div>

        <article className={`${card} sm:col-span-3 xl:col-span-6 xl:p-4`}>
          <CardTitle icon={VenusAndMars}>
            {t("dashboard.population.genderBreakdown")}
          </CardTitle>
          <div className="@container mt-3 flex flex-1 flex-col justify-center">
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row @[20rem]:grid @[20rem]:grid-cols-[1fr_auto_1fr]">
              {ready ? (
                <>
                  <span className="hidden @[20rem]:block" aria-hidden="true" />
                  <Donut segments={gender} total={total} />
                  <Legend segments={gender} />
                </>
              ) : (
                <Skeleton className="size-28 rounded-full" aria-hidden="true" />
              )}
            </div>
          </div>
        </article>

        <article className={`${card} sm:col-span-3 xl:col-span-6 xl:p-4`}>
          <CardTitle icon={UsersRound}>
            {t("dashboard.population.ageBrackets")}
          </CardTitle>
          {ready ? (
            <ul className="mt-3 flex h-28 flex-1 items-end gap-1.5 border-b">
              {ages.map((item, index) => (
                <li
                  key={item.bracket}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                >
                  <span className="mb-1 text-center text-xs tabular-nums text-muted-foreground">
                    {formatLocaleNumber(item.count)}
                  </span>
                  <div
                    className={`bar-rise mx-auto w-full max-w-10 rounded-t-md ${statTones[statCycle[index % statCycle.length]].bg}`}
                    style={
                      {
                        height: `${(item.count / maxAge) * 80}%`,
                        minHeight: item.count > 0 ? "4px" : "0",
                        "--bar-delay": `${index * 60}ms`,
                      } as CSSProperties
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Skeleton className="mt-3 h-28 w-full" aria-hidden="true" />
          )}
          {ready ? (
            <ul className="mt-2 flex gap-1.5">
              {ages.map((item) => (
                <li
                  key={item.bracket}
                  className="min-w-0 flex-1 whitespace-nowrap text-center text-xs text-muted-foreground"
                >
                  {item.bracket.replace("-", "–")}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>

      {/* Row 2: purok list, civil status ring and the four sector tiles. */}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-24">
        <article className={`${card} xl:col-span-7 xl:p-4`}>
          <CardTitle icon={MapPin}>
            {t("dashboard.population.perPurok")}
          </CardTitle>
          <div className="mt-3 flex flex-1 flex-col justify-center gap-3">
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <Skeleton
                    key={index}
                    className="h-5 w-full"
                    aria-hidden="true"
                  />
                ))
              : null}
            {puroks.map((item, index) => (
              <div key={item.purok} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 truncate">
                  {t("dashboard.population.purok", { number: item.purok })}
                </span>
                <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`bar-grow h-full rounded-full ${statTones[statCycle[index % statCycle.length]].bg}`}
                    style={
                      {
                        width: `${(item.count / maxPurok) * 100}%`,
                        "--bar-delay": `${index * 80}ms`,
                      } as CSSProperties
                    }
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                  {formatLocaleNumber(item.count)}
                </span>
              </div>
            ))}
            {ready && puroks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.population.purokEmpty")}
              </p>
            ) : null}
          </div>
        </article>

        <article className={`${card} xl:col-span-7 xl:p-4`}>
          <CardTitle icon={ChartPie}>
            {t("dashboard.population.civilStatus")}
          </CardTitle>
          <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-4 sm:flex-row">
            {ready ? (
              <>
                <Donut segments={civil} total={total} />
                <Legend segments={civil} inline />
              </>
            ) : (
              <Skeleton className="size-28 rounded-full" aria-hidden="true" />
            )}
          </div>
        </article>

        <article className={`${card} sm:col-span-2 xl:col-span-10 xl:p-4`}>
          <CardTitle icon={UsersRound}>
            {t("dashboard.population.sectoral")}
          </CardTitle>
          <div className="mt-3 grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
            {sectoral ? (
              <>
                <SectorTile
                  label={t("dashboard.population.pwd")}
                  value={sectoral.pwd}
                  total={total}
                  icon={Accessibility}
                  tone="blue"
                />
                <SectorTile
                  label={t("dashboard.population.seniorCitizens")}
                  value={sectoral.senior_citizens}
                  total={total}
                  icon={PersonStanding}
                  tone="green"
                />
                <SectorTile
                  label={t("dashboard.population.children")}
                  value={sectoral.children}
                  total={total}
                  icon={Baby}
                  tone="amber"
                />
                <SectorTile
                  label={t("dashboard.population.soloParents")}
                  value={sectoral.solo_parents}
                  total={total}
                  icon={UsersRound}
                  tone="violet"
                />
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="h-32 w-full"
                  aria-hidden="true"
                />
              ))
            )}
          </div>
        </article>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("dashboard.population.note")}
      </p>
    </section>
  )
}
