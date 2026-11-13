import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
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
import { TablePagination } from "@/components/Common/TablePagination"
import { formatLocaleDate } from "@/lib/locale"

type ArchivedResidentsViewProps = {
  isAdmin: boolean
  onViewProfile: (resident: ResidentPublic) => void
  onRestore: (resident: ResidentPublic) => void
}

/** Archived residents with the reason and date, and a Restore button. */
export function ArchivedResidentsView({
  isAdmin,
  onViewProfile,
  onRestore,
}: ArchivedResidentsViewProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    )
    return () => window.clearTimeout(timer)
  }, [search])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the search is the trigger.
  useEffect(() => {
    setPageIndex(0)
  }, [debouncedSearch])

  // The key starts with "residents", so archiving or restoring a resident
  // anywhere on the Records page refreshes this list too.
  const query = useQuery({
    queryKey: ["residents", "archived", debouncedSearch, pageIndex, pageSize],
    queryFn: async () =>
      (
        await ResidentsService.listResidents({
          query: {
            q: debouncedSearch || undefined,
            status: "archived",
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

  const columns = [
    "resident",
    "archivedOn",
    "archivedBy",
    "reason",
    "actions",
  ] as const

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
        <div>
          <h2 className="font-semibold tracking-tight">
            {t("records.archive.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("records.archive.description")}
          </p>
        </div>
        <label className="relative block min-w-0 sm:max-w-sm">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className={`px-4 py-3 align-middle font-medium sm:px-5 ${column === "actions" ? "sticky right-0 bg-muted sticky-head-cell text-right" : ""}`}
                    >
                      {column === "resident" || column === "actions"
                        ? t(`records.list.columns.${column}`)
                        : t(`records.archive.columns.${column}`)}
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
                    <td className="px-4 py-3 align-middle sm:px-5">
                      <p className="font-semibold">{resident.full_name}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                      {resident.archived_at
                        ? formatLocaleDate(new Date(resident.archived_at), {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "Asia/Manila",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle sm:px-5">
                      {resident.archived_by_name || "—"}
                    </td>
                    <td className="max-w-[320px] px-4 py-3 align-middle sm:px-5">
                      <p className="line-clamp-2 break-words">
                        {resident.archive_reason || "—"}
                      </p>
                    </td>
                    <td className="sticky right-0 bg-card row-hover-cell px-4 py-3 align-middle sm:px-5 sticky-edge">
                      <RowActions
                        name={resident.full_name}
                        isAdmin={isAdmin}
                        primary={
                          isAdmin
                            ? {
                                label: t("records.actions.restore"),
                                variant: "outline",
                                onSelect: () => onRestore(resident),
                              }
                            : {
                                label: t("records.actions.viewProfile"),
                                variant: "outline",
                                onSelect: () => onViewProfile(resident),
                              }
                        }
                        items={[
                          {
                            label: t("records.actions.viewProfile"),
                            adminOnly: true,
                            onSelect: () => onViewProfile(resident),
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
                    : t("records.archive.empty.title")
                }
                description={
                  debouncedSearch
                    ? t("records.list.empty.description")
                    : t("records.archive.empty.description")
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
