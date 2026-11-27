import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Eye, Pencil, Search, Undo2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { type ResidentPublic, ResidentsService } from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { RowActions } from "@/components/Common/RowActions"
import {
  PageCheckbox,
  RowCheckbox,
  SelectionBar,
  selectCol,
} from "@/components/Common/SelectionControls"
import { SortLabel } from "@/components/Common/SortLabel"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { cardTable } from "@/lib/cardTable"
import { deathDateText } from "@/lib/deaths"
import type { ResidentSortBy } from "@/lib/residents"
import { rowOpen } from "@/lib/rowOpen"
import { useRowSelection } from "@/lib/useRowSelection"
import { useServerSort } from "@/lib/useSort"

type DeceasedResidentsViewProps = {
  isAdmin: boolean
  onViewProfile: (resident: ResidentPublic) => void
  onCorrect: (resident: ResidentPublic) => void
  onVoid: (resident: ResidentPublic) => void
}

const evidenceStyleKey = { reported: "Reported", verified: "Verified" } as const

/**
 * Residents recorded as deceased (patch 328), with the date as far as it is
 * known, the evidence and who recorded it. Everyone who may open Records can
 * read it; only an administrator can correct a record or void a mistake.
 */
export function DeceasedResidentsView({
  isAdmin,
  onViewProfile,
  onCorrect,
  onVoid,
}: DeceasedResidentsViewProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  // Heading clicks sort the whole list on the server, not one page (315).
  // The age at death is worked out on read, so it is not a sort column.
  const sort = useServerSort({
    resident: "name",
    dateOfDeath: "death_date",
    evidence: "death_evidence",
    recordedBy: "death_recorded_by",
  })

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    )
    return () => window.clearTimeout(timer)
  }, [search])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the search and sort are the trigger.
  useEffect(() => {
    setPageIndex(0)
  }, [debouncedSearch, sort.key])

  // The key starts with "residents", so recording, correcting or voiding a
  // death anywhere on the Records page refreshes this list too.
  const query = useQuery({
    queryKey: [
      "residents",
      "deceased",
      debouncedSearch,
      sort.key,
      pageIndex,
      pageSize,
    ],
    queryFn: async () =>
      (
        await ResidentsService.listResidents({
          query: {
            q: debouncedSearch || undefined,
            status: "deceased",
            sort_by: sort.by as ResidentSortBy,
            sort_dir: sort.by ? sort.dir : undefined,
            skip: pageIndex * pageSize,
            limit: pageSize,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const residents = query.data?.data ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? pageIndex * pageSize + 1 : 0
  const end = Math.min((pageIndex + 1) * pageSize, total)

  // Server pages: a selection lasts only while its rows are on screen.
  const pick = useRowSelection(residents, (resident) => String(resident.id))
  const columns = [
    "resident",
    "dateOfDeath",
    "ageAtDeath",
    "evidence",
    "recordedBy",
    "actions",
  ] as const

  const dateOf = (resident: ResidentPublic) =>
    resident.death ? deathDateText(resident.death, t) : "—"
  const ageOf = (resident: ResidentPublic) =>
    resident.death?.age_at_death != null
      ? String(resident.death.age_at_death)
      : "—"
  const evidenceOf = (resident: ResidentPublic) =>
    resident.death
      ? t(`records.death.evidence.${resident.death.evidence}`)
      : "—"

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
        <div>
          <h2 className="font-semibold tracking-tight">
            {t("records.deceased.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("records.deceased.description")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="relative block min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">{t("records.list.searchLabel")}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("records.list.searchPlaceholder")}
              className={`${formControlClass} pl-9`}
            />
          </label>
          <SelectionBar
            inline
            reserveLine="sm"
            count={pick.count}
            onClear={pick.clear}
            csvName="deceased-residents-selected.csv"
            csvRows={() => [
              columns
                .filter((column) => column !== "actions")
                .map((column) =>
                  column === "resident"
                    ? t("records.list.columns.resident")
                    : t(`records.deceased.columns.${column}`),
                ),
              ...pick
                .pick(residents)
                .map((resident) => [
                  resident.full_name,
                  dateOf(resident),
                  ageOf(resident),
                  evidenceOf(resident),
                  resident.death?.recorded_by_name || "—",
                ]),
            ]}
          />
        </div>
      </div>
      {query.isLoading ? (
        <LoadingState title={t("records.list.loading")} />
      ) : query.isError ? (
        <ErrorState
          title={t("records.list.loadError.title")}
          description={t("records.list.loadError.description")}
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <div className={cardTable.box}>
            <table
              className={`w-full min-w-[820px] text-left text-sm @max-[59rem]/cards:min-w-0 ${cardTable.table}`}
            >
              <thead
                className={`bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground ${cardTable.head}`}
              >
                <tr>
                  <th className={selectCol}>
                    <PageCheckbox
                      all={pick.allOnPage}
                      some={pick.someOnPage}
                      onChange={pick.togglePage}
                    />
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      aria-sort={sort.ariaSort(column)}
                      className={`px-4 py-3 align-middle font-medium @[59rem]/cards:px-5 ${column === "actions" ? "sticky right-0 bg-muted sticky-head-cell text-center" : ""}`}
                    >
                      <SortLabel
                        sort={sort}
                        column={column}
                        label={
                          column === "resident" || column === "actions"
                            ? t(`records.list.columns.${column}`)
                            : t(`records.deceased.columns.${column}`)
                        }
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${cardTable.body}`}>
                {residents.map((resident) => (
                  <tr
                    key={resident.id}
                    data-testid="deceased-row"
                    {...rowOpen(() => onViewProfile(resident))}
                    className={`transition-colors hover:bg-muted/30 ${cardTable.row} ${cardTable.selectRow}`}
                  >
                    <td className={`${selectCol} ${cardTable.select}`}>
                      <RowCheckbox
                        label={resident.full_name}
                        checked={pick.isSelected(String(resident.id))}
                        onChange={() => pick.toggle(String(resident.id))}
                      />
                    </td>
                    <td
                      className={`px-4 py-3 align-middle @[59rem]/cards:px-5 ${cardTable.full} ${cardTable.selectName}`}
                    >
                      <p className="font-semibold">{resident.full_name}</p>
                    </td>
                    <td
                      data-label={t("records.deceased.columns.dateOfDeath")}
                      className={`whitespace-nowrap px-4 py-3 align-middle @[59rem]/cards:px-5 ${cardTable.labelled}`}
                    >
                      {dateOf(resident)}
                    </td>
                    <td
                      data-label={t("records.deceased.columns.ageAtDeath")}
                      className={`whitespace-nowrap px-4 py-3 align-middle @[59rem]/cards:px-5 ${cardTable.labelled}`}
                    >
                      {ageOf(resident)}
                    </td>
                    <td
                      data-label={t("records.deceased.columns.evidence")}
                      className={`px-4 py-3 align-middle @[59rem]/cards:px-5 ${cardTable.labelled}`}
                    >
                      {resident.death ? (
                        <Badge
                          variant="outline"
                          className={
                            statusStyles[
                              evidenceStyleKey[resident.death.evidence]
                            ]
                          }
                        >
                          {evidenceOf(resident)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      data-label={t("records.deceased.columns.recordedBy")}
                      className={`px-4 py-3 align-middle @[59rem]/cards:px-5 ${cardTable.labelled}`}
                    >
                      {resident.death?.recorded_by_name || "—"}
                    </td>
                    <td
                      className={`sticky right-0 bg-card row-hover-cell px-4 py-3 align-middle @[59rem]/cards:px-5 sticky-edge ${cardTable.actions}`}
                    >
                      <RowActions
                        compact
                        className="@max-[59rem]/cards:flex-wrap @max-[59rem]/cards:justify-start"
                        name={resident.full_name}
                        isAdmin={isAdmin}
                        primary={{
                          label: t("records.actions.viewProfile"),
                          variant: "tintTeal",
                          icon: <Eye aria-hidden="true" />,
                          onSelect: () => onViewProfile(resident),
                        }}
                        items={[
                          {
                            label: t("records.actions.correctDeath"),
                            icon: (
                              <Pencil aria-hidden="true" className="size-4" />
                            ),
                            adminOnly: true,
                            onSelect: () => onCorrect(resident),
                          },
                          {
                            label: t("records.actions.voidDeath"),
                            icon: (
                              <Undo2 aria-hidden="true" className="size-4" />
                            ),
                            adminOnly: true,
                            destructive: true,
                            onSelect: () => onVoid(resident),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {residents.length === 0 ? (
              <EmptyState
                title={
                  debouncedSearch
                    ? t("records.list.empty.title")
                    : t("records.deceased.empty.title")
                }
                description={
                  debouncedSearch
                    ? t("records.list.empty.description")
                    : t("records.deceased.empty.description")
                }
              />
            ) : null}
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
    </section>
  )
}
