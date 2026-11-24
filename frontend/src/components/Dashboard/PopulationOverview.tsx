import type { ParseKeys } from "i18next"
import {
  Accessibility,
  Baby,
  Building2,
  ChartPie,
  Feather,
  GraduationCap,
  House,
  MapPin,
  PersonStanding,
  User,
  UsersRound,
  VenusAndMars,
  Vote,
} from "lucide-react"
import { type CSSProperties, type ReactNode, useState } from "react"
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

// Hover linking: the key under the pointer is "active"; everything else in the
// same card fades a little. The motion-reduce rule keeps the fade but drops
// the movement. Pointer only: all figures stay readable without it.
type ActiveKey = string | null
const fade = (active: ActiveKey, key: string) =>
  active !== null && active !== key ? "opacity-40" : ""
const hoverMove =
  "transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"

function CardTitle({
  icon: Icon,
  children,
}: {
  icon: typeof UsersRound
  children: ReactNode
}) {
  return (
    <h3 className="stat-label flex items-center gap-2">
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
    <article
      className={`flex min-w-0 flex-col items-stretch gap-2 rounded-xl border bg-card p-3 text-left shadow-sm 2xl:p-4 ${hoverMove}`}
    >
      <div className="flex items-center justify-start gap-2">
        <span
          className={`shrink-0 rounded-md bg-muted p-1.5 2xl:p-2 ${statTones[tone].text}`}
        >
          <Icon className="size-4 2xl:size-5" aria-hidden="true" />
        </span>
        <p className="stat-label min-w-0 leading-tight">{title}</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <p className="stat-figure text-center text-3xl 2xl:text-4xl">
          {value !== undefined ? (
            <AnimatedNumber value={value} />
          ) : loading ? (
            <Skeleton className="h-8 w-20 2xl:h-9" />
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
function Donut({
  segments,
  total,
  active,
  onActive,
}: {
  segments: Segment[]
  total: number
  active: ActiveKey
  onActive: (key: ActiveKey) => void
}) {
  const { t } = useTranslation()
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const sum = segments.reduce((acc, item) => acc + item.value, 0)
  let offset = 0
  const current = segments.find((item) => item.key === active)
  return (
    <div
      className="relative mx-auto size-36 shrink-0 sm:size-40"
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
            // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only highlight; every figure stays visible without it
            <circle
              key={item.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth={active === item.key ? 18 : 14}
              stroke="currentColor"
              className={`cursor-pointer transition-all duration-200 motion-reduce:transition-none ${statTones[item.tone].text} ${fade(active, item.key)}`}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              onMouseEnter={() => onActive(item.key)}
              onMouseLeave={() => onActive(null)}
            />
          )
          offset += length
          return length > 0 ? circle : null
        })}
      </svg>
      {/* The centre shows the total, or the hovered segment's own count. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <span className="stat-figure text-xl">
          {formatLocaleNumber(current ? current.value : total)}
        </span>
        <span className="max-w-full truncate text-xs leading-4 text-muted-foreground">
          {current ? current.label : t("dashboard.population.chartTotal")}
        </span>
      </div>
    </div>
  )
}

function Legend({
  segments,
  active,
  onActive,
  inline = false,
}: {
  segments: Segment[]
  active: ActiveKey
  onActive: (key: ActiveKey) => void
  inline?: boolean
}) {
  const sum = segments.reduce((acc, item) => acc + item.value, 0)
  return (
    <ul className={`min-w-0 ${inline ? "space-y-2" : "space-y-2.5"}`}>
      {segments.map((item) => (
        <li
          key={item.key}
          className={`-mx-1.5 flex cursor-default gap-2 rounded-md px-1.5 py-0.5 transition duration-200 motion-reduce:transition-none ${active === item.key ? "bg-muted" : ""} ${fade(active, item.key)} ${inline ? "items-center" : "items-start"}`}
          onMouseEnter={() => onActive(item.key)}
          onMouseLeave={() => onActive(null)}
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

// Two rows of four: age groups first, then the sectors.
const sectorTiles = [
  {
    key: "children",
    label: "dashboard.population.children",
    icon: Baby,
    tone: "amber",
  },
  {
    key: "teens",
    label: "dashboard.population.teens",
    icon: GraduationCap,
    tone: "teal",
  },
  {
    key: "adults",
    label: "dashboard.population.adults",
    icon: User,
    tone: "blue",
  },
  {
    key: "senior_citizens",
    label: "dashboard.population.seniorCitizens",
    icon: PersonStanding,
    tone: "green",
  },
  {
    key: "pwd",
    label: "dashboard.population.pwd",
    icon: Accessibility,
    tone: "blue",
  },
  {
    key: "solo_parents",
    label: "dashboard.population.soloParents",
    icon: UsersRound,
    tone: "violet",
  },
  {
    key: "urban_poor",
    label: "dashboard.population.urbanPoor",
    icon: Building2,
    tone: "rose",
  },
  {
    key: "indigenous_people",
    label: "dashboard.population.indigenousPeople",
    icon: Feather,
    tone: "amber",
  },
] as const satisfies readonly {
  key: keyof NonNullable<DashboardPopulation["sectoral"]>
  label: ParseKeys
  icon: typeof UsersRound
  tone: StatTone
}[]

function SectorTile({
  label,
  value,
  total,
  icon: Icon,
  tone,
  faded,
  onActive,
}: {
  label: string
  value: number
  total: number
  icon: typeof UsersRound
  tone: StatTone
  faded: boolean
  onActive: (active: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only highlight; every figure stays visible without it
    <div
      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/40 px-2 py-4 text-center ${hoverMove} ${faded ? "opacity-40" : ""}`}
      onMouseEnter={() => onActive(true)}
      onMouseLeave={() => onActive(false)}
    >
      <Icon className={`size-6 ${statTones[tone].text}`} aria-hidden="true" />
      <p className={`text-xs font-semibold ${statTones[tone].text}`}>{label}</p>
      <p className="stat-figure mt-0.5 text-2xl">
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
  const [genderActive, setGenderActive] = useState<ActiveKey>(null)
  const [civilActive, setCivilActive] = useState<ActiveKey>(null)
  const [ageActive, setAgeActive] = useState<ActiveKey>(null)
  const [purokActive, setPurokActive] = useState<ActiveKey>(null)
  const [sectorActive, setSectorActive] = useState<ActiveKey>(null)

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
                  <Donut
                    segments={gender}
                    total={total}
                    active={genderActive}
                    onActive={setGenderActive}
                  />
                  <Legend
                    segments={gender}
                    active={genderActive}
                    onActive={setGenderActive}
                  />
                </>
              ) : (
                <Skeleton
                  className="size-36 rounded-full sm:size-40"
                  aria-hidden="true"
                />
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
                  title={`${item.bracket.replace("-", "–")}: ${formatLocaleNumber(item.count)}`}
                  className={`flex h-full min-w-0 flex-1 cursor-default flex-col justify-end transition-opacity duration-200 motion-reduce:transition-none ${fade(ageActive, item.bracket)}`}
                  onMouseEnter={() => setAgeActive(item.bracket)}
                  onMouseLeave={() => setAgeActive(null)}
                >
                  <span
                    className={`mb-1 text-center text-xs tabular-nums ${ageActive === item.bracket ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                  >
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
                  className={`min-w-0 flex-1 whitespace-nowrap text-center text-xs transition-opacity duration-200 motion-reduce:transition-none ${ageActive === item.bracket ? "font-semibold text-foreground" : "text-muted-foreground"} ${fade(ageActive, item.bracket)}`}
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
              // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only highlight; every figure stays visible without it
              <div
                key={item.purok}
                className={`-mx-2 flex cursor-default items-center gap-3 rounded-md px-2 py-0.5 text-sm transition duration-200 motion-reduce:transition-none ${purokActive === String(item.purok) ? "bg-muted" : ""} ${fade(purokActive, String(item.purok))}`}
                onMouseEnter={() => setPurokActive(String(item.purok))}
                onMouseLeave={() => setPurokActive(null)}
              >
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
          <div className="mt-3 flex min-w-0 flex-1 flex-col items-center justify-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
            {ready ? (
              <>
                <Donut
                  segments={civil}
                  total={total}
                  active={civilActive}
                  onActive={setCivilActive}
                />
                <Legend
                  segments={civil}
                  active={civilActive}
                  onActive={setCivilActive}
                  inline
                />
              </>
            ) : (
              <Skeleton
                className="size-36 rounded-full sm:size-40"
                aria-hidden="true"
              />
            )}
          </div>
        </article>

        <article className={`${card} sm:col-span-2 xl:col-span-10 xl:p-4`}>
          <CardTitle icon={UsersRound}>
            {t("dashboard.population.sectoral")}
          </CardTitle>
          <div className="mt-3 grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {sectoral
              ? sectorTiles.map(({ key, label, icon, tone }) => (
                  <SectorTile
                    key={key}
                    label={t(label)}
                    value={sectoral[key]}
                    total={total}
                    icon={icon}
                    tone={tone}
                    faded={sectorActive !== null && sectorActive !== key}
                    onActive={(on) => setSectorActive(on ? key : null)}
                  />
                ))
              : Array.from({ length: 8 }, (_, index) => (
                  <Skeleton
                    key={index}
                    className="h-28 w-full"
                    aria-hidden="true"
                  />
                ))}
          </div>
        </article>
      </div>
    </section>
  )
}
