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
import { StatCard } from "@/components/Common/StatCard"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { formatBusinessDate } from "@/lib/residents"

type StatusFilter = "all" | BarangayIdListItem["status"]

const PAGE_SIZE = 10

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
    queryKey: ["barangay-ids", debouncedSearch, statusFilter, pageIndex],
    queryFn: async () =>
      (
        await BarangayIdsService.idsListBarangayIds({
          query: {
            q: debouncedSearch || undefined,
            status: statusFilter,
            skip: pageIndex * PAGE_SIZE,
            limit: PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const records = idsQuery.data?.data ?? []
  const total = idsQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total ? pageIndex * PAGE_SIZE + 1 : 0
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, total)

  const allCount = useIdCount("all")
  const validCount = useIdCount("valid")
  const soonCount = useIdCount("expiring_soon")
  const expiredCount = useIdCount("expired")
  const show = (count: number | undefined) =>
    count === undefined ? "—" : String(count)

  return (
    <>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
            <label className="sm:w-52">
              <span className="sr-only">
                {t("records.ids.statusFilterLabel")}
              </span>
              <select
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
              </select>
            </label>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {idColumns.map((column) => (
                      <th
                        key={column}
                        className={`px-4 py-3 align-middle font-medium sm:px-5 ${column === "actions" ? "text-right" : ""}`}
                      >
                        {t(`records.ids.columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => {
                    const archived = record.resident_status === "archived"
                    const needsRenewal =
                      record.status === "expiring_soon" ||
                      record.status === "expired"
                    return (
                      <tr
                        key={record.issuance_id}
                        className={`transition-colors hover:bg-muted/30 ${archived ? "opacity-70" : ""}`}
                      >
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <p className="font-semibold">
                            {record.resident_name}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {record.reference_no}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle font-mono sm:px-5">
                          {record.id_number}
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          {isTransactionType(record.transaction_type)
                            ? t(
                                `records.ids.transaction.${record.transaction_type}`,
                              )
                            : record.transaction_type}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          {formatBusinessDate(record.issue_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          <p>{formatBusinessDate(record.valid_until)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {expiryRelative(record.valid_until, t)}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
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
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <RowActions
                            name={record.resident_name}
                            isAdmin={isAdmin}
                            primary={
                              archived
                                ? undefined
                                : needsRenewal
                                  ? {
                                      label: t("records.ids.renew"),
                                      icon: <RefreshCw aria-hidden="true" />,
                                      onSelect: () =>
                                        openIdIssuance(record.resident_id),
                                    }
                                  : {
                                      label: t("records.ids.replaceCard"),
                                      variant: "outline",
                                      title: t("records.ids.replaceHint"),
                                      onSelect: () =>
                                        openIdIssuance(record.resident_id),
                                    }
                            }
                            items={[
                              {
                                label: t("records.ids.replaceCard"),
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
            />
          </>
        )}
      </section>
    </>
  )
}
