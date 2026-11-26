import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import {
  CalendarClock,
  Clock3,
  CreditCard,
  IdCard,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { BarangayIdListItem } from "@/client"
import { BarangayIdsService } from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { RowActions } from "@/components/Common/RowActions"
import { Select } from "@/components/Common/Select"
import {
  PageCheckbox,
  RowCheckbox,
  SelectionBar,
  selectCol,
} from "@/components/Common/SelectionControls"
import { StatCard } from "@/components/Common/StatCard"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { cardTable } from "@/lib/cardTable"
import { formatBusinessDate } from "@/lib/residents"
import { useRowSelection } from "@/lib/useRowSelection"
import { IdSeriesCard } from "./IdSeriesCard"

type StatusFilter = "all" | BarangayIdListItem["status"]

// statusStyles is keyed by the English status word, not by the shown label.
const statusStyleKey: Record<BarangayIdListItem["status"], string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
}

const transactionTypes = ["new", "renewal", "replacement"] as const
type TransactionType = (typeof transactionTypes)[number]

function isTransactionType(value: string): value is TransactionType {
  return (transactionTypes as readonly string[]).includes(value)
}

const idColumns = [
  "resident",
  "idNumber",
  "card",
  "issued",
  "validUntil",
  "status",
  "actions",
] as const

/** Today's business date in Manila, as YYYY-MM-DD. */
function manilaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
}

function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / 86400000)
}

function expiryRelative(validUntil: string, t: TFunction) {
  const days = dayNumber(validUntil) - dayNumber(manilaToday())
  if (days === 0) return t("records.ids.relative.today")
  if (days > 0) return t("records.ids.relative.inDays", { count: days })
  const ago = Math.abs(days)
  if (ago < 30) return t("records.ids.relative.daysAgo", { count: ago })
  const months = Math.floor(ago / 30)
  return t("records.ids.relative.monthsAgo", { count: months })
}

// Printing a card, renewing and replacing all go through Issuances.
function openIdIssuance(residentId: string) {
  window.location.assign(
    `/issuances?resident=${encodeURIComponent(residentId)}&type=BARANGAY_ID`,
  )
}

function useIdCount(status: StatusFilter) {
  return useQuery({
    queryKey: ["barangay-id-count", status],
    queryFn: async () =>
      (
        await BarangayIdsService.idsListBarangayIds({
          query: { status, limit: 1 },
        })
      ).data.count,
  })
}

export function BarangayIdsView() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    )
    return () => window.clearTimeout(timer)
  }, [search])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the filters are the trigger.
  useEffect(() => {
    setPageIndex(0)
  }, [debouncedSearch, statusFilter])

  const idsQuery = useQuery({
    queryKey: [
      "barangay-ids",
      debouncedSearch,
      statusFilter,
      pageIndex,
      pageSize,
    ],
    queryFn: async () =>
      (
        await BarangayIdsService.idsListBarangayIds({
          query: {
            q: debouncedSearch || undefined,
            status: statusFilter,
            skip: pageIndex * pageSize,
            limit: pageSize,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const records = idsQuery.data?.data ?? []
  const total = idsQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? pageIndex * pageSize + 1 : 0
  const end = Math.min((pageIndex + 1) * pageSize, total)
  // Server pages: a selection lasts only while its rows are on screen.
  const pick = useRowSelection(records, (record) => String(record.issuance_id))

  const allCount = useIdCount("all")
  const validCount = useIdCount("valid")
  const soonCount = useIdCount("expiring_soon")
  const expiredCount = useIdCount("expired")
  const show = (count: number | undefined) =>
    count === undefined ? "—" : String(count)

  return (
    <>
      {isAdmin ? <IdSeriesCard /> : null}
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t("records.ids.summaryAria")}
      >
        <StatCard
          icon={IdCard}
          label={t("records.ids.stats.all.label")}
          value={show(allCount.data)}
          description={t("records.ids.stats.all.description")}
        />
        <StatCard
          icon={CreditCard}
          label={t("records.ids.stats.valid.label")}
          value={show(validCount.data)}
          description={t("records.ids.stats.valid.description")}
        />
        <StatCard
          icon={Clock3}
          label={t("records.ids.stats.expiring.label")}
          value={show(soonCount.data)}
          description={t("records.ids.stats.expiring.description")}
        />
        <StatCard
          icon={CalendarClock}
          label={t("records.ids.stats.expired.label")}
          value={show(expiredCount.data)}
          description={t("records.ids.stats.expired.description")}
        />
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">
              {t("records.ids.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("records.ids.description")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">{t("records.ids.searchLabel")}</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("records.ids.searchPlaceholder")}
                className={`${formControlClass} pl-9`}
              />
            </label>
            <label htmlFor="ids-status-filter" className="sm:w-52">
              <span className="sr-only">
                {t("records.ids.statusFilterLabel")}
              </span>
              <Select
                id="ids-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className={formControlClass}
              >
                <option value="all">{t("records.ids.statusAll")}</option>
                <option value="valid">{t("records.idStatus.valid")}</option>
                <option value="expiring_soon">
                  {t("records.idStatus.expiring_soon")}
                </option>
                <option value="expired">{t("records.idStatus.expired")}</option>
              </Select>
            </label>
            <SelectionBar
              inline
              count={pick.count}
              onClear={pick.clear}
              csvName="barangay-ids-selected.csv"
              csvRows={() => [
                idColumns
                  .filter((column) => column !== "actions")
                  .map((column) => t(`records.ids.columns.${column}`)),
                ...pick
                  .pick(records)
                  .map((record) => [
                    `${record.resident_name} (${record.reference_no})`,
                    record.id_number,
                    isTransactionType(record.transaction_type)
                      ? t(`records.ids.transaction.${record.transaction_type}`)
                      : record.transaction_type,
                    formatBusinessDate(record.issue_date),
                    formatBusinessDate(record.valid_until),
                    t(`records.idStatus.${record.status}`),
                  ]),
              ]}
            />
          </div>
        </div>

        {idsQuery.isLoading ? (
          <LoadingState title={t("records.ids.loading")} />
        ) : idsQuery.isError ? (
          <ErrorState
            title={t("records.ids.loadError.title")}
            description={t("records.ids.loadError.description")}
            onRetry={() => idsQuery.refetch()}
          />
        ) : (
          <>
            <div className={cardTable.box}>
              <table
                className={`w-full min-w-[900px] text-left text-sm @max-[59rem]/cards:min-w-0 ${cardTable.table}`}
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
                    {idColumns.map((column) => (
                      <th
                        key={column}
                        className={`px-2.5 py-3 align-middle font-medium ${column === "actions" ? "sticky right-0 bg-muted sticky-head-cell text-center" : ""}`}
                      >
                        {t(`records.ids.columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${cardTable.body}`}>
                  {records.map((record) => {
                    const archived = record.resident_status === "archived"
                    const needsRenewal =
                      record.status === "expiring_soon" ||
                      record.status === "expired"
                    return (
                      <tr
                        key={record.issuance_id}
                        className={`transition-colors hover:bg-muted/30 ${cardTable.row} ${cardTable.selectRow} ${archived ? "opacity-70" : ""}`}
                      >
                        <td className={`${selectCol} ${cardTable.select}`}>
                          <RowCheckbox
                            label={record.resident_name}
                            checked={pick.isSelected(
                              String(record.issuance_id),
                            )}
                            onChange={() =>
                              pick.toggle(String(record.issuance_id))
                            }
                          />
                        </td>
                        <td
                          className={`px-2.5 py-3 align-middle ${cardTable.full} ${cardTable.selectName}`}
                        >
                          <p className="font-semibold">
                            {record.resident_name}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {record.reference_no}
                          </p>
                        </td>
                        <td
                          data-label={t("records.ids.columns.idNumber")}
                          className={`whitespace-nowrap px-2.5 py-3 align-middle font-mono ${cardTable.labelled}`}
                        >
                          {record.id_number}
                        </td>
                        <td
                          data-label={t("records.ids.columns.card")}
                          className={`px-2.5 py-3 align-middle ${cardTable.labelled}`}
                        >
                          {isTransactionType(record.transaction_type)
                            ? t(
                                `records.ids.transaction.${record.transaction_type}`,
                              )
                            : record.transaction_type}
                        </td>
                        <td
                          data-label={t("records.ids.columns.issued")}
                          className={`whitespace-nowrap px-2.5 py-3 align-middle ${cardTable.labelled}`}
                        >
                          {formatBusinessDate(record.issue_date)}
                        </td>
                        <td
                          data-label={t("records.ids.columns.validUntil")}
                          className={`whitespace-nowrap px-2.5 py-3 align-middle ${cardTable.labelled}`}
                        >
                          <p>{formatBusinessDate(record.valid_until)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {expiryRelative(record.valid_until, t)}
                          </p>
                        </td>
                        <td
                          className={`px-2.5 py-3 align-middle ${cardTable.cell}`}
                        >
                          <div className="flex flex-wrap gap-1">
                            <Badge
                              variant="outline"
                              className={
                                statusStyles[statusStyleKey[record.status]]
                              }
                            >
                              {t(`records.idStatus.${record.status}`)}
                            </Badge>
                            {archived ? (
                              <Badge
                                variant="outline"
                                className={statusStyles.Archived}
                              >
                                {t("records.ids.residentArchived")}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className={`sticky right-0 bg-card row-hover-cell px-2.5 py-3 align-middle sticky-edge ${cardTable.actions}`}
                        >
                          <RowActions
                            compact
                            className="@max-[59rem]/cards:flex-wrap @max-[59rem]/cards:justify-start"
                            name={record.resident_name}
                            isAdmin={isAdmin}
                            primary={
                              archived
                                ? undefined
                                : needsRenewal
                                  ? {
                                      label: t("records.ids.renew"),
                                      variant: "tintGreen",
                                      icon: <RefreshCw aria-hidden="true" />,
                                      onSelect: () =>
                                        openIdIssuance(record.resident_id),
                                    }
                                  : {
                                      label: t("records.ids.replaceCard"),
                                      variant: "tintBlue",
                                      icon: <CreditCard aria-hidden="true" />,
                                      title: t("records.ids.replaceHint"),
                                      onSelect: () =>
                                        openIdIssuance(record.resident_id),
                                    }
                            }
                            items={[
                              {
                                label: t("records.ids.replaceCard"),
                                icon: (
                                  <CreditCard
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                ),
                                hidden: archived || !needsRenewal,
                                title: t("records.ids.replaceHint"),
                                onSelect: () =>
                                  openIdIssuance(record.resident_id),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {records.length === 0 ? (
                <EmptyState
                  title={t("records.ids.empty.title")}
                  description={t("records.ids.empty.description")}
                  action={
                    search.trim() !== "" || statusFilter !== "all" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => {
                          setSearch("")
                          setStatusFilter("all")
                        }}
                      >
                        <X aria-hidden="true" />
                        {t("issuances.history.resetFilters")}
                      </Button>
                    ) : undefined
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
    </>
  )
}
