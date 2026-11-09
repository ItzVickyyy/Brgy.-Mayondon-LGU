import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { TFunction } from "i18next"
import { Search, UserRound, UserRoundPlus } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type OfficialCreate,
  type OfficialPublic,
  OfficialsService,
  type OfficialUpdate,
} from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { NoPermission } from "@/components/Common/NoPermission"
import { RowActions } from "@/components/Common/RowActions"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  TablePagination,
  usePagination,
} from "@/components/Common/TablePagination"
import { refreshLookups } from "@/components/Issuances/NewIssuance/issuanceApi"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
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
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { getLocaleOr } from "@/lib/locale"
import { readApiError } from "@/lib/residents"

type OfficialRecord = {
  id: string
  name: string
  position: string
  termStart: string
  termEnd: string | null
  status: "Current" | "Former"
  elected: boolean
}

type OfficialChange =
  | { kind: "create"; body: OfficialCreate }
  | { kind: "update"; id: string; body: OfficialUpdate }

const positionOptions = [
  "Punong Barangay",
  "Barangay Kagawad",
  "SK Chairperson",
  "OIC Kagawad",
  "Barangay Secretary",
  "Barangay Treasurer",
  "Barangay Clerk",
  "Administrative Assistant",
]

function toRecord(official: OfficialPublic): OfficialRecord {
  return {
    id: official.id,
    name: official.full_name,
    position: official.position,
    termStart: official.term_start,
    termEnd: official.term_end ?? null,
    status: official.is_current ? "Current" : "Former",
    elected: official.is_elected,
  }
}

async function saveChange(change: OfficialChange) {
  if (change.kind === "create") {
    return (await OfficialsService.createOfficial({ body: change.body })).data
  }
  return (
    await OfficialsService.updateOfficial({
      path: { official_id: change.id },
      body: change.body,
    })
  ).data
}

const electedPositions = new Set([
  "Punong Barangay",
  "Barangay Kagawad",
  "SK Chairperson",
])

function isElectedPosition(value: string) {
  return electedPositions.has(value)
}

export const Route = createFileRoute("/_layout/officials")({
  component: OfficialsManagement,
  head: () => ({ meta: [{ title: pageTitle("Officials") }] }),
})

const positionRank: Record<string, number> = {
  "Punong Barangay": 0,
  "Barangay Kagawad": 1,
  "SK Chairperson": 2,
  "Barangay Secretary": 3,
  "Barangay Treasurer": 4,
  "OIC Kagawad": 2,
  "Barangay Clerk": 5,
  "Administrative Assistant": 6,
}

const columnIds = ["name", "position", "term", "status", "actions"] as const

function statusLabel(status: OfficialRecord["status"], t: TFunction) {
  return status === "Current"
    ? t("admin.officials.statusCurrent")
    : t("admin.officials.statusFormer")
}

function formatTermDate(value: string | null, noEndDate: string) {
  if (!value) return noEndDate
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(getLocaleOr("en-US"), {
        month: "short",
        year: "numeric",
      })
}

function OfficialsManagement() {
  const { t } = useTranslation()
  const noEndDate = t("admin.officials.noEndDate")
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const queryClient = useQueryClient()
  const officialsQuery = useQuery({
    queryKey: ["officials"],
    queryFn: async () =>
      (await OfficialsService.listOfficials({ query: { status: "all" } })).data,
    enabled: isAdmin,
  })
  const officials = useMemo(
    () => (officialsQuery.data ?? []).map(toRecord),
    [officialsQuery.data],
  )
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "Current" | "Former" | "all"
  >("Current")
  const [formOpen, setFormOpen] = useState(false)
  const [editingOfficial, setEditingOfficial] = useState<OfficialRecord | null>(
    null,
  )
  const [viewOfficial, setViewOfficial] = useState<OfficialRecord | null>(null)
  const [endTermOfficial, setEndTermOfficial] = useState<OfficialRecord | null>(
    null,
  )
  const [termEndDate, setTermEndDate] = useState("2026-11-30")
  const [name, setName] = useState("")
  const [position, setPosition] = useState("Punong Barangay")
  const [termStart, setTermStart] = useState("2026-11-01")
  const [termEnd, setTermEnd] = useState("2029-10-31")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState<"" | "added" | "updated">("")

  const mutation = useMutation({
    mutationFn: saveChange,
    onSuccess: (_result, change) => {
      setError("")
      setNotice(change.kind === "create" ? "added" : "updated")
      setFormOpen(false)
      setEndTermOfficial(null)
      // The issuance form keeps its own copy of the officials list; drop it so
      // a new signatory or witness shows up there without a page reload.
      refreshLookups()
      void queryClient.invalidateQueries({ queryKey: ["officials"] })
      void queryClient.invalidateQueries({ queryKey: ["issuance-officials"] })
      void queryClient.invalidateQueries({ queryKey: ["issuance-lookups"] })
    },
    onError: (caught) => {
      setNotice("")
      setError(readApiError(caught).message)
    },
  })

  const filteredOfficials = useMemo(() => {
    const query = search.trim().toLowerCase()
    return officials
      .filter((official) => {
        const matchesSearch = [
          official.name,
          official.position,
          official.status,
          statusLabel(official.status, t),
        ].some((value) => value.toLowerCase().includes(query))
        return (
          matchesSearch &&
          (statusFilter === "all" || official.status === statusFilter)
        )
      })
      .sort(
        (a, b) =>
          (positionRank[a.position] ?? 99) - (positionRank[b.position] ?? 99) ||
          a.name.localeCompare(b.name),
      )
  }, [officials, search, statusFilter, t])
  const officialPagination = usePagination(
    filteredOfficials,
    10,
    `${search}|${statusFilter}`,
  )

  if (!isAdmin) return <NoPermission />

  function clearMessages() {
    setError("")
    setNotice("")
  }

  function openAddForm() {
    clearMessages()
    setEditingOfficial(null)
    setName("")
    setPosition("Punong Barangay")
    setTermStart("2026-11-01")
    setTermEnd("2029-10-31")
    setFormOpen(true)
  }

  function openEditForm(official: OfficialRecord) {
    clearMessages()
    setEditingOfficial(official)
    setName(official.name)
    setPosition(official.position)
    setTermStart(official.termStart)
    setTermEnd(official.termEnd ?? "")
    setFormOpen(true)
  }

  function saveOfficial() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (termEnd && termEnd < termStart) {
      setError(t("admin.officials.errors.termEndBeforeStart"))
      return
    }
    setError("")
    const body = {
      full_name: trimmed,
      position,
      term_start: termStart,
      term_end: termEnd || null,
      is_elected: isElectedPosition(position),
    }
    mutation.mutate(
      editingOfficial
        ? { kind: "update", id: editingOfficial.id, body }
        : { kind: "create", body: { ...body, is_current: true } },
    )
  }

  function endTerm() {
    if (!endTermOfficial) return
    if (termEndDate < endTermOfficial.termStart) {
      setError(t("admin.officials.errors.termEndBeforeStart"))
      return
    }
    setError("")
    mutation.mutate({
      kind: "update",
      id: endTermOfficial.id,
      body: { term_end: termEndDate, is_current: false },
    })
  }

  function reinstate(official: OfficialRecord) {
    clearMessages()
    mutation.mutate({
      kind: "update",
      id: official.id,
      body: { is_current: true },
    })
  }

  const dialogError = error ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.officials.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("admin.officials.subtitle")}
          </p>
        </div>
        <Button onClick={openAddForm}>
          <UserRoundPlus aria-hidden="true" />
          {t("admin.officials.addButton")}
        </Button>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-lg border bg-card p-3 text-sm font-medium"
        >
          {notice === "added"
            ? t("admin.officials.noticeAdded")
            : t("admin.officials.noticeUpdated")}
        </p>
      ) : null}
      {error && !formOpen && !endTermOfficial ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-card p-3 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand/10 p-2.5 text-brand">
              <UserRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">
                {t("admin.officials.listTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.officials.listDescription")}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">
                {t("admin.officials.searchLabel")}
              </span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin.officials.searchPlaceholder")}
                className={`${formControlClass} pl-9`}
              />
            </label>
            <label className="sm:w-44">
              <span className="sr-only">
                {t("admin.officials.filterStatus")}
              </span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "Current" | "Former" | "all",
                  )
                }
                className={formControlClass}
              >
                <option value="Current">{statusLabel("Current", t)}</option>
                <option value="Former">{statusLabel("Former", t)}</option>
                <option value="all">{t("admin.officials.allStatuses")}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columnIds.map((id) => (
                  <th
                    key={id}
                    className={
                      id === "actions"
                        ? "sticky right-0 bg-muted sticky-head-cell px-4 py-3 text-right font-medium sm:px-5"
                        : "px-4 py-3 align-middle font-medium sm:px-5"
                    }
                  >
                    {t(`admin.officials.columns.${id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {officialPagination.paginatedItems.map((official) => (
                <tr
                  key={official.id}
                  className={`transition-colors hover:bg-muted/30 ${official.status === "Former" ? "opacity-70" : ""}`}
                >
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <p className="font-semibold">{official.name}</p>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    {official.position}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                    {formatTermDate(official.termStart, noEndDate)} –{" "}
                    {formatTermDate(official.termEnd, noEndDate)}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Badge
                      variant="outline"
                      className={statusStyles[official.status]}
                    >
                      {statusLabel(official.status, t)}
                    </Badge>
                  </td>
                  <td className="sticky right-0 bg-card row-hover-cell px-4 py-3 align-middle sm:px-5 sticky-edge">
                    <RowActions
                      name={official.name}
                      isAdmin
                      primary={
                        official.status === "Current"
                          ? {
                              label: t("admin.officials.actions.edit"),
                              variant: "outline",
                              onSelect: () => openEditForm(official),
                            }
                          : {
                              label: t("admin.officials.actions.view"),
                              variant: "outline",
                              onSelect: () => setViewOfficial(official),
                            }
                      }
                      items={[
                        {
                          label: t("admin.officials.actions.endTerm"),
                          hidden: official.status !== "Current",
                          destructive: true,
                          onSelect: () => {
                            clearMessages()
                            setTermEndDate(official.termEnd ?? "")
                            setEndTermOfficial(official)
                          },
                        },
                        {
                          label: t("admin.officials.actions.reinstate"),
                          hidden: official.status !== "Former",
                          disabled: mutation.isPending,
                          onSelect: () => reinstate(official),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {officialsQuery.isLoading ? (
            <LoadingState title={t("admin.officials.loading")} />
          ) : null}
          {officialsQuery.isError ? (
            <ErrorState
              title={t("admin.officials.loadError.title")}
              description={t("admin.officials.loadError.description")}
              onRetry={() => void officialsQuery.refetch()}
            />
          ) : null}
          {!officialsQuery.isLoading &&
          !officialsQuery.isError &&
          filteredOfficials.length === 0 ? (
            <EmptyState
              title={t("admin.officials.noMatch.title")}
              description={
                officials.length === 0
                  ? t("admin.officials.noMatch.descriptionEmpty")
                  : t("admin.officials.noMatch.descriptionFilter")
              }
              action={
                officials.length > 0 &&
                (search.trim() !== "" || statusFilter !== "Current") ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setSearch("")
                      setStatusFilter("Current")
                    }}
                  >
                    {t("issuances.history.resetFilters")}
                  </Button>
                ) : undefined
              }
            />
          ) : null}
        </div>
        <TablePagination
          start={officialPagination.start}
          end={officialPagination.end}
          total={officialPagination.total}
          pageIndex={officialPagination.pageIndex}
          pageCount={officialPagination.pageCount}
          onPageChange={officialPagination.setPageIndex}
          pageSize={officialPagination.pageSize}
          onPageSizeChange={officialPagination.setPageSize}
        />
      </section>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!mutation.isPending) setFormOpen(open)
        }}
      >
        <DialogContent className={`${modalShell} sm:max-w-2xl`}>
          <DialogHeader className={modalHeader}>
            <DialogTitle className="text-xl">
              {editingOfficial
                ? t("admin.officials.form.editTitle")
                : t("admin.officials.form.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.officials.form.description")}
            </DialogDescription>
          </DialogHeader>
          <div className={`${modalBody} grid gap-4 sm:grid-cols-2`}>
            <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
              {t("admin.officials.form.fullName")}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={formControlClass}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
              {t("admin.officials.form.position")}
              <select
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                className={formControlClass}
              >
                {(positionOptions.includes(position)
                  ? positionOptions
                  : [position, ...positionOptions]
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              {t("admin.officials.form.termStart")}
              <input
                type="date"
                value={termStart}
                onChange={(event) => setTermStart(event.target.value)}
                className={formControlClass}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              {t("admin.officials.form.termEnd")}
              <input
                type="date"
                value={termEnd}
                onChange={(event) => setTermEnd(event.target.value)}
                className={formControlClass}
                required
              />
            </label>
            {formOpen ? (
              <div className="sm:col-span-2 empty:hidden">{dialogError}</div>
            ) : null}
          </div>
          <DialogFooter className={modalFooter}>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setFormOpen(false)}
            >
              {t("admin.officials.form.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                mutation.isPending || !name.trim() || !termStart || !termEnd
              }
              onClick={saveOfficial}
            >
              {mutation.isPending
                ? t("admin.officials.form.saving")
                : editingOfficial
                  ? t("admin.officials.form.saveChanges")
                  : t("admin.officials.form.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={endTermOfficial !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setEndTermOfficial(null)
        }}
      >
        <DialogContent className={`${modalShell} sm:max-w-xl`}>
          <DialogHeader className={modalHeader}>
            <DialogTitle className="text-xl">
              {t("admin.officials.endTerm.title")}
            </DialogTitle>
            <DialogDescription>
              {endTermOfficial
                ? t("admin.officials.endTerm.description", {
                    name: endTermOfficial.name,
                  })
                : t("admin.officials.endTerm.descriptionFallback")}
            </DialogDescription>
          </DialogHeader>
          <div className={`${modalBody} grid gap-4`}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              {t("admin.officials.endTerm.dateLabel")}
              <input
                type="date"
                value={termEndDate}
                onChange={(event) => setTermEndDate(event.target.value)}
                className={formControlClass}
                required
              />
            </label>
            {endTermOfficial ? dialogError : null}
          </div>
          <DialogFooter className={modalFooter}>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setEndTermOfficial(null)}
            >
              {t("admin.officials.form.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutation.isPending || !termEndDate}
              onClick={endTerm}
            >
              {mutation.isPending
                ? t("admin.officials.form.saving")
                : t("admin.officials.endTerm.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewOfficial !== null}
        onOpenChange={(open) => {
          if (!open) setViewOfficial(null)
        }}
      >
        <DialogContent className={`${modalShell} sm:max-w-xl`}>
          <DialogHeader className={modalHeader}>
            <DialogTitle className="text-xl">
              {t("admin.officials.view.title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.officials.view.description")}
            </DialogDescription>
          </DialogHeader>
          {viewOfficial ? (
            <div className={`${modalBody} grid gap-3 text-sm sm:grid-cols-2`}>
              <div className="rounded-lg border bg-card p-4 sm:col-span-2">
                <p className="text-muted-foreground">
                  {t("admin.officials.view.name")}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {viewOfficial.name}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-muted-foreground">
                  {t("admin.officials.view.position")}
                </p>
                <p className="mt-1 font-semibold">{viewOfficial.position}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-muted-foreground">
                  {t("admin.officials.view.term")}
                </p>
                <p className="mt-1 font-semibold">
                  {formatTermDate(viewOfficial.termStart, noEndDate)} –{" "}
                  {formatTermDate(viewOfficial.termEnd, noEndDate)}
                </p>
              </div>
              <div>
                <Badge
                  variant="outline"
                  className={statusStyles[viewOfficial.status]}
                >
                  {statusLabel(viewOfficial.status, t)}
                </Badge>
              </div>
            </div>
          ) : null}
          <DialogFooter className={modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewOfficial(null)}
            >
              {t("admin.officials.view.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
