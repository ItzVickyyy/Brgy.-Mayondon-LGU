import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { ParseKeys, TFunction } from "i18next"
import {
  CalendarDays,
  FileCheck2,
  FilePenLine,
  FileText,
  Search,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { IssuanceListItem, IssuancePublic } from "@/client"
import { DashboardService, IssuancesService, LookupsService } from "@/client"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { RowActions } from "@/components/Common/RowActions"
import { Select } from "@/components/Common/Select"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { SummaryCard } from "@/components/Issuances/IssuanceLayout"
import { issuanceApi } from "@/components/Issuances/NewIssuance/issuanceApi"
import { PrintSplitButton } from "@/components/Issuances/PrintSplitButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { documentTypeLabel } from "@/lib/issuanceLabels"
import { formatBusinessDate, readApiError } from "@/lib/residents"
import { formatLocaleDate } from "@/lib/locale"
import type { PrintMode } from "@/lib/print/printMode"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "issued" | "draft" | "voided"
type PendingAction = {
  item: IssuanceListItem
  action: "void" | "discard" | "correct"
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const historyColumns = [
  "resident",
  "document",
  "purpose",
  "dateIssued",
  "validUntil",
  "status",
  "actions",
] as const
const filterLabelClass =
  "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground"

// The API status word -> the English key `statusStyles` is looked up by, and
// the translation key for the shown label. Unknown statuses show as stored.
const statusStyleKey: Record<string, string> = {
  issued: "Issued",
  draft: "Pending",
  voided: "Voided",
}
const statusLabelKeys = {
  issued: "issuances.history.status.issued",
  draft: "issuances.history.status.draft",
  voided: "issuances.history.status.voided",
} as const satisfies Record<string, ParseKeys>

function statusLabel(status: string, t: TFunction) {
  const key = statusLabelKeys[status as keyof typeof statusLabelKeys]
  return key ? t(key) : status
}

function manilaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
}

function DetailRow({
  label,
  value,
  wide = false,
}: {
  label: string
  value?: string | null
  /** Long text (address, remarks, reasons) takes the full width. */
  wide?: boolean
}) {
  return (
    <div
      className={`rounded-lg border bg-card px-4 py-3 text-sm ${wide ? "sm:col-span-2" : ""}`}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 whitespace-pre-line break-words font-medium">
        {value || "—"}
      </dd>
    </div>
  )
}

function IssuanceDetailsDialog({
  item,
  documentName,
  purposeName,
  onClose,
}: {
  item: IssuanceListItem | null
  documentName: string
  purposeName: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const detailQuery = useQuery({
    queryKey: ["issuance", item?.id],
    enabled: item !== null,
    queryFn: async (): Promise<IssuancePublic> =>
      (
        await IssuancesService.getIssuance({
          path: { issuance_id: item?.id ?? "" },
        })
      ).data,
  })
  const detail = detailQuery.data

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`${modalShell} sm:max-w-2xl`}>
        {item ? (
          <>
            <DialogHeader className={modalHeader}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <DialogTitle className="text-xl leading-snug">
                  {documentName}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={statusStyles[statusStyleKey[item.status] ?? ""]}
                >
                  {statusLabel(item.status, t)}
                </Badge>
              </div>
              <DialogDescription>
                {item.reference_no ??
                  t("issuances.history.details.draftNotNumbered")}{" "}
                · {item.resident_name}
              </DialogDescription>
            </DialogHeader>
            <div className={modalBody}>
            {detailQuery.isLoading ? (
              <LoadingState title={t("issuances.history.details.loading")} />
            ) : detailQuery.isError || !detail ? (
              <ErrorState
                title={t("issuances.history.details.loadError")}
                onRetry={() => detailQuery.refetch()}
              />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label={t("issuances.history.details.status")}
                  value={statusLabel(detail.status, t)}
                />
                <DetailRow
                  label={t("issuances.history.details.documentDate")}
                  value={formatBusinessDate(detail.issue_date)}
                />
                <DetailRow
                  label={t("issuances.history.details.validUntil")}
                  value={
                    detail.expires_on
                      ? formatBusinessDate(detail.expires_on)
                      : null
                  }
                />
                <DetailRow
                  label={t("issuances.history.details.purpose")}
                  value={purposeName}
                />
                <DetailRow
                  label={t("issuances.history.details.remarks")}
                  value={detail.remarks}
                  wide
                />
                <DetailRow
                  label={t("issuances.history.details.address")}
                  value={detail.snapshot?.address_line}
                  wide
                />
                <DetailRow
                  label={t("issuances.history.details.receiptNo")}
                  value={
                    detail.payment
                      ? detail.payment.is_free
                        ? t("issuances.history.details.freeOfCharge")
                        : detail.payment.official_receipt_no
                      : null
                  }
                />
                <DetailRow
                  label={t("issuances.history.details.issuedAt")}
                  value={
                    detail.issued_at
                      ? formatLocaleDate(new Date(detail.issued_at), {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Manila",
                        })
                      : null
                  }
                />
                {detail.correction_reason ? (
                  <DetailRow
                    label={t("issuances.history.details.correctionReason")}
                    value={detail.correction_reason}
                    wide
                  />
                ) : null}
                {detail.void_reason ? (
                  <DetailRow
                    label={t("issuances.history.details.voidReason")}
                    value={detail.void_reason}
                    wide
                  />
                ) : null}
              </dl>
            )}
            </div>
            <DialogFooter className={modalFooter}>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("issuances.history.details.close")}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function IssuanceHistory({
  onNotice,
  onContinueDraft,
  onPrint,
}: {
  onNotice: (message: string) => void
  onContinueDraft: (id: string) => void
  onPrint: (
    item: IssuanceListItem,
    mode?: PrintMode,
  ) => Promise<string | void> | string | void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [viewItem, setViewItem] = useState<IssuanceListItem | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [errorNotice, setErrorNotice] = useState("")

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
  }, [debouncedSearch, typeFilter, statusFilter, dateFrom, dateTo, pageSize])

  const documentTypesQuery = useQuery({
    queryKey: ["lookups", "document-types"],
    queryFn: async () => (await LookupsService.listDocumentTypes()).data,
  })
  const purposesQuery = useQuery({
    queryKey: ["lookups", "issuance-purposes"],
    queryFn: async () => (await LookupsService.listIssuancePurposes()).data,
  })
  const documentTypes = documentTypesQuery.data ?? []
  const documentNames = new Map(
    documentTypes.map((type) => [
      type.id,
      documentTypeLabel(type.code, type.name, t),
    ]),
  )
  const purposeNames = new Map(
    (purposesQuery.data ?? []).map((purpose) => [purpose.id, purpose.name]),
  )

  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo)
  const historyQuery = useQuery({
    queryKey: [
      "issuances",
      debouncedSearch,
      typeFilter,
      statusFilter,
      dateFrom,
      dateTo,
      pageIndex,
      pageSize,
    ],
    queryFn: async () =>
      (
        await IssuancesService.listIssuances({
          query: {
            q: debouncedSearch || undefined,
            document_type_id: typeFilter ? Number(typeFilter) : undefined,
            status: statusFilter,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            skip: pageIndex * pageSize,
            limit: pageSize,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    enabled: !dateRangeInvalid,
  })
  const items = historyQuery.data?.data ?? []
  const total = historyQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? pageIndex * pageSize + 1 : 0
  const end = Math.min((pageIndex + 1) * pageSize, total)

  const overallQuery = useQuery({
    queryKey: ["issuances-summary", "overall"],
    queryFn: async () =>
      (await DashboardService.dashboard({ query: { period: "overall" } })).data,
  })
  const latestQuery = useQuery({
    queryKey: ["issuances-summary", "latest"],
    queryFn: async () =>
      (
        await IssuancesService.listIssuances({
          query: { status: "issued", limit: 1 },
        })
      ).data.data[0],
  })
  const topType = [...(overallQuery.data?.by_document_type ?? [])].sort(
    (a, b) => b.count - a.count,
  )[0]

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["issuances"] })
    void queryClient.invalidateQueries({ queryKey: ["issuances-summary"] })
    void queryClient.invalidateQueries({ queryKey: ["issuance"] })
    void queryClient.invalidateQueries({ queryKey: ["barangay-ids"] })
    void queryClient.invalidateQueries({ queryKey: ["barangay-id-count"] })
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      item,
      action,
      reason,
    }: PendingAction & { reason: string }) => {
      if (action === "void") {
        await IssuancesService.void({
          path: { issuance_id: item.id },
          body: { reason },
        })
        return undefined
      }
      if (action === "correct")
        return await issuanceApi.correctIssuance(item.id, reason)
      await IssuancesService.discardDraft({ path: { issuance_id: item.id } })
      return undefined
    },
    onSuccess: (createdDraft, { item, action }) => {
      setErrorNotice("")
      if (action === "correct" && createdDraft) {
        onNotice(
          item.reference_no
            ? t("issuances.history.notices.correctionCreated", {
                reference: item.reference_no,
              })
            : t("issuances.history.notices.correctionCreatedDocument"),
        )
        onContinueDraft(createdDraft.id)
      } else {
        onNotice(
          action === "void"
            ? item.reference_no
              ? t("issuances.history.notices.voided", {
                  reference: item.reference_no,
                })
              : t("issuances.history.notices.voidedDocument")
            : t("issuances.history.notices.discarded"),
        )
      }
      refresh()
    },
    onError: (error) => setErrorNotice(readApiError(error).message),
  })

  const hasFilters =
    search.trim() !== "" ||
    typeFilter !== "" ||
    statusFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== ""
  const resetFilters = () => {
    setSearch("")
    setTypeFilter("")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
  }
  const today = manilaToday()
  const latest = latestQuery.data

  return (
    <>
      <div className="print:hidden grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={FileCheck2}
          label={t("issuances.history.summary.totalIssued")}
          value={overallQuery.isLoading || overallQuery.isError ? "—" : overallQuery.data?.total_issued ?? 0}
          hint={overallQuery.isError ? t("issuances.history.summary.loadError") : t("issuances.history.summary.totalIssuedHint")}
        />
        <SummaryCard
          icon={CalendarDays}
          label={t("issuances.history.summary.latest")}
          value={
            latestQuery.isLoading || latestQuery.isError
              ? "—"
              : latest
                ? formatBusinessDate(latest.issue_date)
                : t("issuances.history.summary.latestNone")
          }
          hint={latestQuery.isError ? t("issuances.history.summary.loadError") : t("issuances.history.summary.latestHint")}
        />
        <SummaryCard
          icon={FileText}
          label={t("issuances.history.summary.mostIssued")}
          value={overallQuery.isLoading || overallQuery.isError ? "—" : topType && topType.count > 0 ? topType.count : 0}
          hint={
            overallQuery.isError
              ? t("issuances.history.summary.loadError")
              : overallQuery.isLoading
                ? t("issuances.history.summary.loading")
                : topType && topType.count > 0
                ? documentTypeLabel(topType.code, topType.name, t)
                : t("issuances.history.summary.mostIssuedNone")
          }
        />
      </div>

      {errorNotice ? (
        <div
          role="alert"
          className="print:hidden flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p className="flex-1">{errorNotice}</p>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setErrorNotice("")}
            aria-label={t("issuances.history.dismissError")}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <section className="print:hidden overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col border-b">
          <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
            <div>
              <h2 className="font-semibold tracking-tight">
                {t("issuances.history.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("issuances.history.description")}
              </p>
            </div>
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={resetFilters}
              >
                <X aria-hidden="true" />
                {t("issuances.history.resetFilters")}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 border-t bg-muted/30 p-4 sm:px-5">
          {/* One row on wide screens: search and the two dropdowns flex, the
              two dates keep a fixed width so they never wrap onto a second row. */}
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_9.75rem_9.75rem]">
            <label
              className={`${filterLabelClass} sm:col-span-2 xl:col-span-1`}
            >
              <span>{t("issuances.history.filters.search")}</span>
              <span className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("issuances.history.filters.searchPlaceholder")}
                  className={cn(formControlClass, "pl-9")}
                />
              </span>
            </label>
            <label htmlFor="history-document-type-filter" className={filterLabelClass}>
              <span>{t("issuances.history.filters.documentType")}</span>
              <Select id="history-document-type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={formControlClass}
              >
                <option value="">
                  {t("issuances.history.filters.allDocumentTypes")}
                </option>
                {documentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {documentTypeLabel(type.code, type.name, t)}
                  </option>
                ))}
              </Select>
            </label>
            <label htmlFor="history-status-filter" className={filterLabelClass}>
              <span>{t("issuances.history.filters.status")}</span>
              <Select id="history-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className={formControlClass}
              >
                <option value="all">
                  {t("issuances.history.filters.allStatuses")}
                </option>
                <option value="issued">{statusLabel("issued", t)}</option>
                <option value="draft">{statusLabel("draft", t)}</option>
                <option value="voided">{statusLabel("voided", t)}</option>
              </Select>
            </label>
            <label className={filterLabelClass}>
              <span>{t("issuances.history.filters.datedFrom")}</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || manilaToday()}
                onChange={(event) => setDateFrom(event.target.value)}
                className={formControlClass}
              />
            </label>
            <label className={filterLabelClass}>
              <span>{t("issuances.history.filters.datedTo")}</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                max={manilaToday()}
                onChange={(event) => setDateTo(event.target.value)}
                className={formControlClass}
              />
            </label>
          </div>
          {dateRangeInvalid ? (
            <p role="alert" className="text-sm text-destructive">
              {t("issuances.history.dateRangeInvalid")}
            </p>
          ) : null}
          </div>
        </div>

        {dateRangeInvalid ? (
          <EmptyState
            title={t("issuances.history.invalidDateRangeTitle")}
            description={t("issuances.history.invalidDateRangeDescription")}
          />
        ) : historyQuery.isLoading ? (
          <LoadingState title={t("issuances.history.loading")} />
        ) : historyQuery.isError ? (
          <ErrorState
            title={t("issuances.history.loadError")}
            description={t("issuances.history.loadErrorDescription")}
            onRetry={() => historyQuery.refetch()}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {historyColumns.map((column) => (
                      <th
                        key={column}
                        className={`px-4 py-3 align-middle font-medium sm:px-5 ${column === "actions" ? "sticky right-0 bg-muted sticky-head-cell text-right" : ""}`}
                      >
                        {t(`issuances.history.columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const isDraft = item.status === "draft"
                    const isIssued = item.status === "issued"
                    const canReprint = [
                      "BARANGAY_CLEARANCE",
                      "FRANCHISE_CLEARANCE",
                      "UTILITY_CLEARANCE",
                      "INDIGENCY",
                      "MARGINALIZED_SECTOR",
                      "ASSISTANCE",
                    ].includes(item.document_type_code)
                    const styleKey = statusStyleKey[item.status] ?? item.status
                    const label = statusLabel(item.status, t)
                    const expired = Boolean(
                      isIssued && item.expires_on && item.expires_on < today,
                    )
                    const documentName =
                      documentNames.get(item.document_type_id) ??
                      item.document_type_code
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <p className="font-semibold">{item.resident_name}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {item.reference_no ??
                              t("issuances.history.notNumbered")}
                          </p>
                        </td>
                        <td className="max-w-xs px-4 py-3 align-middle sm:px-5">
                          {documentName}
                        </td>
                        <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">
                          {(item.purpose_id &&
                            purposeNames.get(item.purpose_id)) ||
                            "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          {isDraft ? "—" : formatBusinessDate(item.issue_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                          {item.expires_on ? (
                            <div className="flex flex-col items-start gap-1">
                              <span>{formatBusinessDate(item.expires_on)}</span>
                              {expired ? (
                                <Badge
                                  variant="outline"
                                  className={statusStyles.Expired}
                                >
                                  {t("issuances.history.expired")}
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <Badge
                            variant="outline"
                            className={statusStyles[styleKey]}
                          >
                            {label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5 sticky right-0 bg-card row-hover-cell sticky-edge">
                          <RowActions
                            name={item.resident_name}
                            isAdmin={isAdmin}
                            leading={
                              isIssued && canReprint ? (
                                <PrintSplitButton
                                  name={item.resident_name}
                                  onPrint={async (mode) => {
                                    try {
                                      const message = await onPrint(item, mode)
                                      if (message) onNotice(message)
                                    } catch (error) {
                                      setErrorNotice(readApiError(error).message)
                                    }
                                  }}
                                />
                              ) : undefined
                            }
                            primary={{
                              label: t("issuances.history.actions.view"),
                              variant: "outline",
                              onSelect: () => setViewItem(item),
                            }}
                            items={[
                              {
                                label: t("issuances.history.actions.void"),
                                adminOnly: true,
                                hidden: !isIssued,
                                destructive: true,
                                onSelect: () =>
                                  setPending({ item, action: "void" }),
                              },
                              {
                                label: t(
                                  "issuances.history.actions.continueDraft",
                                ),
                                hidden: !isDraft,
                                icon: (
                                  <FilePenLine
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                ),
                                onSelect: () => onContinueDraft(item.id),
                              },
                              {
                                label: t("issuances.history.actions.correct"),
                                hidden: !isIssued,
                                icon: (
                                  <FilePenLine
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                ),
                                onSelect: () =>
                                  setPending({ item, action: "correct" }),
                              },
                              {
                                label: t("issuances.history.actions.discard"),
                                hidden: !isDraft,
                                destructive: true,
                                onSelect: () =>
                                  setPending({ item, action: "discard" }),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {items.length === 0 ? (
                <EmptyState
                  title={t("issuances.history.empty.title")}
                  description={t("issuances.history.empty.description")}
                  action={
                    hasFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={resetFilters}
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
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              pageSizeLabel={t("issuances.history.pageSize")}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </section>

      <IssuanceDetailsDialog
        item={viewItem}
        documentName={
          viewItem
            ? (documentNames.get(viewItem.document_type_id) ??
              viewItem.document_type_code)
            : ""
        }
        purposeName={
          (viewItem?.purpose_id && purposeNames.get(viewItem.purpose_id)) || ""
        }
        onClose={() => setViewItem(null)}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title={
          pending?.action === "void"
            ? t("issuances.history.confirm.voidTitle")
            : pending?.action === "correct"
              ? t("issuances.history.confirm.correctTitle")
              : t("issuances.history.confirm.discardTitle")
        }
        description={
          pending
            ? pending.action === "void"
              ? t("issuances.history.confirm.voidDescription", {
                  reference: pending.item.reference_no,
                })
              : pending.action === "correct"
                ? t("issuances.history.confirm.correctDescription")
                : t("issuances.history.confirm.discardDescription")
            : ""
        }
        confirmLabel={
          pending?.action === "void"
            ? t("issuances.history.confirm.voidConfirm")
            : pending?.action === "correct"
              ? t("issuances.history.confirm.correctConfirm")
              : t("issuances.history.confirm.discardConfirm")
        }
        destructive={pending?.action !== "correct"}
        reason={
          pending?.action === "void" || pending?.action === "correct"
            ? "required"
            : "none"
        }
        onConfirm={(reason) => {
          if (!pending) return
          actionMutation.mutate({ ...pending, reason })
          setPending(null)
        }}
      />
    </>
  )
}
