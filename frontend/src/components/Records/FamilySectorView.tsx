import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { UserRound, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ResidentPublic } from "@/client"
import { ResidentsService } from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { TablePagination } from "@/components/Common/TablePagination"
import { Button } from "@/components/ui/button"
import { residentTypeLabel } from "@/lib/residentLabels"
import { residentAddress } from "@/lib/residents"

// Family and beneficiary details wait for the barangay's own list of fields (D-20).
const waitingCards = [
  { key: "family", icon: Users },
  { key: "beneficiary", icon: UserRound },
] as const

const columns = ["name", "address", "type", "actions"] as const

type Props = {
  streets: Map<number, string>
  onViewProfile: (resident: ResidentPublic) => void
}

export function FamilySectorView({ streets, onViewProfile }: Props) {
  const { t } = useTranslation()
  const [sectorId, setSectorId] = useState<number | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  // biome-ignore lint/correctness/useExhaustiveDependencies: choosing a sector is the trigger.
  useEffect(() => {
    setPageIndex(0)
  }, [sectorId])

  // Keys start with "residents" so the Records page refreshes them after an edit.
  const summaryQuery = useQuery({
    queryKey: ["residents", "sector-summary"],
    queryFn: async () => (await ResidentsService.sectorSummary()).data,
  })
  const counts = summaryQuery.data?.data ?? []
  const selected = counts.find((row) => row.sector_id === sectorId)

  const residentsQuery = useQuery({
    queryKey: ["residents", "by-sector", sectorId, pageIndex, pageSize],
    queryFn: async () =>
      (
        await ResidentsService.listResidents({
          query: {
            sector_id: sectorId ?? undefined,
            status: "active",
            skip: pageIndex * pageSize,
            limit: pageSize,
          },
        })
      ).data,
    enabled: sectorId !== null,
    placeholderData: keepPreviousData,
  })
  const residents = residentsQuery.data?.data ?? []
  const total = residentsQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? pageIndex * pageSize + 1 : 0
  const end = Math.min((pageIndex + 1) * pageSize, total)

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
          <Users className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold tracking-tight">
            {t("records.familySector.title")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("records.familySector.description")}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border bg-background p-4">
        <h3 className="font-semibold">
          {t("records.familySector.sector.title")}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("records.familySector.sector.description")}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("records.familySector.sectors.assignHint")}
        </p>

        {summaryQuery.isLoading ? (
          <LoadingState title={t("records.familySector.sectors.loading")} />
        ) : summaryQuery.isError ? (
          <ErrorState
            title={t("records.familySector.sectors.loadError.title")}
            description={t(
              "records.familySector.sectors.loadError.description",
            )}
            onRetry={() => summaryQuery.refetch()}
          />
        ) : (
          <>
            <p className="mt-3 text-sm font-medium">
              {t("records.familySector.sectors.summary", {
                n: summaryQuery.data?.residents_with_sector ?? 0,
              })}
            </p>
            <ul
              className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              aria-label={t("records.familySector.sectors.listAria")}
            >
              {counts.map((row) => {
                const isSelected = row.sector_id === sectorId
                return (
                  <li key={row.sector_id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        setSectorId(isSelected ? null : row.sector_id)
                      }
                      className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        isSelected ? "border-brand bg-brand/10" : "bg-card"
                      }`}
                    >
                      <span className="min-w-0 break-words font-medium">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {t("records.familySector.sectors.residentCount", {
                          count: row.active_residents,
                        })}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border">
          {sectorId === null ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t("records.familySector.sectors.choose")}
            </p>
          ) : (
            <>
              <h4 className="border-b px-4 py-3 font-semibold">
                {t("records.familySector.sectors.listTitle", {
                  sector: selected?.name ?? "",
                })}
              </h4>
              {residentsQuery.isLoading ? (
                <LoadingState
                  title={t("records.familySector.sectors.loadingResidents")}
                />
              ) : residentsQuery.isError ? (
                <ErrorState
                  title={t("records.familySector.sectors.residentsError.title")}
                  description={t(
                    "records.familySector.sectors.residentsError.description",
                  )}
                  onRetry={() => residentsQuery.refetch()}
                />
              ) : residents.length === 0 ? (
                <EmptyState
                  title={t("records.familySector.sectors.empty.title")}
                  description={t(
                    "records.familySector.sectors.empty.description",
                  )}
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          {columns.map((column) => (
                            <th
                              key={column}
                              className={`px-4 py-3 align-middle font-medium sm:px-5 ${column === "actions" ? "text-right" : ""}`}
                            >
                              {t(
                                `records.familySector.sectors.columns.${column}`,
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {residents.map((resident) => (
                          <tr
                            key={resident.id}
                            className="transition-colors hover:bg-muted/30"
                          >
                            <td className="px-4 py-3 align-middle font-semibold sm:px-5">
                              {resident.full_name}
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              {residentAddress(resident, streets) || "—"}
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              {resident.residency_type
                                ? t(
                                    `records.residency.${resident.residency_type}`,
                                  )
                                : resident.resident_type
                                  ? residentTypeLabel(resident.resident_type, t)
                                  : "—"}
                            </td>
                            <td className="px-4 py-3 text-right align-middle sm:px-5">
                              <Button
                                variant="outline"
                                className="min-h-11"
                                onClick={() => onViewProfile(resident)}
                                aria-label={`${t("records.actions.viewProfile")}: ${resident.full_name}`}
                              >
                                {t("records.actions.viewProfile")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    start={start}
                    end={end}
                    total={total}
                    pageIndex={pageIndex}
                    pageCount={pageCount}
                    onPageChange={setPageIndex}
                    pageSize={pageSize}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPageIndex(0)
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {waitingCards.map((item) => (
          <article
            key={item.key}
            className="flex min-h-36 flex-col rounded-xl border bg-background p-4"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-semibold">
                {t(`records.familySector.${item.key}.title`)}
              </h3>
            </div>
            <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
              {t(`records.familySector.${item.key}.description`)}
            </p>
            <Button
              variant="outline"
              className="mt-4 min-h-11 self-start"
              disabled
              title={t("records.familySector.unavailableHint")}
            >
              {t("records.familySector.unavailable")}
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
