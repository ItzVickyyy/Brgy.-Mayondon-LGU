import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { CalendarDays, FileCheck2, FileText, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
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
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { SummaryCard } from "@/components/Issuances/IssuanceLayout"
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
import { formatBusinessDate, readApiError } from "@/lib/residents"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "issued" | "draft" | "voided"
type PendingAction = { item: IssuanceListItem; action: "void" | "discard" }

const PAGE_SIZE = 10
const filterLabelClass =
  "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground"

const statusText: Record<string, string> = {
  issued: "Issued",
  draft: "Pending",
  voided: "Voided",
}

function manilaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
}

const momentFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
})

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || "—"}</dd>
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
      <DialogContent className="max-w-lg">
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle>{documentName}</DialogTitle>
              <DialogDescription>
                {item.reference_no ?? "Draft, not yet numbered"} ·{" "}
                {item.resident_name}
              </DialogDescription>
            </DialogHeader>
            {detailQuery.isLoading ? (
              <LoadingState title="Loading details..." />
            ) : detailQuery.isError || !detail ? (
              <ErrorState
                title="Could not load details"
                onRetry={() => detailQuery.refetch()}
              />
            ) : (
              <dl className="divide-y">
                <DetailRow
                  label="Status"
                  value={statusText[detail.status] ?? detail.status}
                />
                <DetailRow
                  label="Document date"
                  value={formatBusinessDate(detail.issue_date)}
                />
                <DetailRow
                  label="Valid until"
                  value={
                    detail.expires_on
                      ? formatBusinessDate(detail.expires_on)
                      : null
                  }
                />
                <DetailRow label="Purpose" value={purposeName} />
                <DetailRow label="Remarks" value={detail.remarks} />
                <DetailRow
                  label="Address"
                  value={detail.snapshot?.address_line}
                />
                <DetailRow
                  label="Receipt no."
                  value={
                    detail.payment
                      ? detail.payment.is_free
                        ? "Free of charge"
                        : detail.payment.official_receipt_no
                      : null
                  }
                />
                <DetailRow
                  label="Issued at"
                  value={
                    detail.issued_at
                      ? momentFormat.format(new Date(detail.issued_at))
                      : null
                  }
                />
                {detail.correction_reason ? (
                  <DetailRow
                    label="Correction reason"
                    value={detail.correction_reason}
                  />
                ) : null}
                {detail.void_reason ? (
                  <DetailRow label="Void reason" value={detail.void_reason} />
                ) : null}
              </dl>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
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
}: {
  onNotice: (message: string) => void
}) {
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [pageIndex, setPageIndex] = useState(0)
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
  }, [debouncedSearch, typeFilter, statusFilter])

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
    documentTypes.map((type) => [type.id, type.name]),
  )
  const purposeNames = new Map(
    (purposesQuery.data ?? []).map((purpose) => [purpose.id, purpose.name]),
  )

  const historyQuery = useQuery({
    queryKey: [
      "issuances",
      debouncedSearch,
      typeFilter,
      statusFilter,
      pageIndex,
    ],
    queryFn: async () =>
      (
        await IssuancesService.listIssuances({
          query: {
            q: debouncedSearch || undefined,
            document_type_id: typeFilter ? Number(typeFilter) : undefined,
            status: statusFilter,
            skip: pageIndex * PAGE_SIZE,
            limit: PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const items = historyQuery.data?.data ?? []
  const total = historyQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total ? pageIndex * PAGE_SIZE + 1 : 0
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, total)

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
      } else {
        await IssuancesService.discardDraft({ path: { issuance_id: item.id } })
      }
    },
    onSuccess: (_data, { item, action }) => {
      setErrorNotice("")
      onNotice(
        action === "void"
          ? `${item.reference_no ?? "The document"} was voided.`
          : "The draft was discarded.",
      )
      refresh()
    },
    onError: (error) => setErrorNotice(readApiError(error).message),
  })

  const hasFilters =
    search.trim() !== "" || typeFilter !== "" || statusFilter !== "all"
  const today = manilaToday()
  const latest = latestQuery.data

  return (
    <>
      <div className="print:hidden grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={FileCheck2}
          label="Total issued"
          value={overallQuery.data ? overallQuery.data.total_issued : "—"}
          hint="All recorded issuances"
        />
        <SummaryCard
          icon={CalendarDays}
          label="Latest issuance"
          value={latest ? formatBusinessDate(latest.issue_date) : "None yet"}
          hint="Most recent record date"
        />
        <SummaryCard
          icon={FileText}
          label="Most issued document"
          value={topType && topType.count > 0 ? topType.count : 0}
          hint={topType && topType.count > 0 ? topType.name : "No records yet"}
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
            aria-label="Dismiss message"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <section className="print:hidden overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Issuance History</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search and filter issuance records.
              </p>
            </div>
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setSearch("")
                  setTypeFilter("")
                  setStatusFilter("all")
                }}
              >
                <X aria-hidden="true" />
                Reset filters
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1.4fr_1fr]">
            <label
              className={`${filterLabelClass} sm:col-span-2 xl:col-span-1`}
            >
              <span>Search</span>
              <span className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by reference or resident name"
                  className={cn(formControlClass, "pl-9")}
                />
              </span>
            </label>
            <label className={filterLabelClass}>
              <span>Document type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={formControlClass}
              >
                <option value="">All document types</option>
                {documentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className={formControlClass}
              >
                <option value="all">All statuses</option>
                <option value="issued">Issued</option>
                <option value="draft">Pending</option>
                <option value="voided">Voided</option>
              </select>
            </label>
          </div>
        </div>

        {historyQuery.isLoading ? (
          <LoadingState title="Loading issuances..." />
        ) : historyQuery.isError ? (
          <ErrorState
            title="Could not load issuances"
            description="Check your connection and try again."
            onRetry={() => historyQuery.refetch()}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      "Resident",
                      "Document",
                      "Purpose",
                      "Date issued",
                      "Valid until",
                      "Status",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        className={`px-4 py-3 align-middle font-medium sm:px-5 ${label === "Actions" ? "text-right" : ""}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const isDraft = item.status === "draft"
                    const isIssued = item.status === "issued"
                    const label = statusText[item.status] ?? item.status
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
                            {item.reference_no ?? "Not numbered yet"}
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
                                  Expired
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
                            className={statusStyles[label]}
                          >
                            {label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-middle sm:px-5">
                          <RowActions
                            name={item.resident_name}
                            isAdmin={isAdmin}
                            primary={{
                              label: "View",
                              variant: "outline",
                              onSelect: () => setViewItem(item),
                            }}
                            items={[
                              {
                                label: "Void issuance",
                                adminOnly: true,
                                hidden: !isIssued,
                                destructive: true,
                                onSelect: () =>
                                  setPending({ item, action: "void" }),
                              },
                              {
                                label: "Discard draft",
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
                  title="No records found"
                  description="Try a different search or document type, or create a new issuance."
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
        title={pending?.action === "void" ? "Void issuance?" : "Discard draft?"}
        description={
          pending
            ? pending.action === "void"
              ? `Void ${pending.item.reference_no}? It stays in the history and cannot be edited. A reason is required.`
              : "Discard this pending draft? It will be deleted."
            : ""
        }
        confirmLabel={
          pending?.action === "void" ? "Void issuance" : "Discard draft"
        }
        destructive
        reason={pending?.action === "void" ? "required" : "none"}
        onConfirm={(reason) => {
          if (!pending) return
          actionMutation.mutate({ ...pending, reason })
          setPending(null)
        }}
      />
    </>
  )
}
