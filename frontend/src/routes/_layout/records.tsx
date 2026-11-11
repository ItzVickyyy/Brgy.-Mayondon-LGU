import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Archive,
  CheckCircle2,
  CreditCard,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  BarangayIdsService,
  LookupsService,
  type ResidentPublic,
  ResidentsService,
} from "@/client"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { RowActions } from "@/components/Common/RowActions"
import { Select } from "@/components/Common/Select"
import { StatCard } from "@/components/Common/StatCard"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { ArchivedResidentsView } from "@/components/Records/ArchivedResidentsView"
import { BarangayIdsView } from "@/components/Records/BarangayIdsView"
import { FamilySectorView } from "@/components/Records/FamilySectorView"
import { ImportMasterlistView } from "@/components/Records/ImportMasterlistView"
import { LookupListsView } from "@/components/Records/LookupListsView"
import { ResidentFormDialog } from "@/components/Records/ResidentFormDialog"
import { ResidentProfileDialog } from "@/components/Records/ResidentProfileDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { residentTypeLabel } from "@/lib/residentLabels"
import {
  formatBusinessDate,
  readApiError,
  residentAddress,
  streetNameMap,
} from "@/lib/residents"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/records")({
  component: RecordsManagement,
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: "barangay-ids" } =>
    search.view === "barangay-ids" ? { view: "barangay-ids" } : {},
  head: () => ({ meta: [{ title: pageTitle("Records Management") }] }),
})

type View =
  | "residents"
  | "archived"
  | "barangay-ids"
  | "family-sector"
  | "lists"
  | "import"

const inputClass = formControlClass

// statusStyles is keyed by the English status word, not by the shown label.
const idStatusStyleKey: Record<ResidentPublic["id_status"], string> = {
  none: "None",
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
}

type ResidentColumn =
  | "resident"
  | "birthdate"
  | "address"
  | "type"
  | "idStatus"
  | "status"
  | "actions"

const residentColumns: ResidentColumn[] = [
  "resident",
  "birthdate",
  "address",
  "type",
  "idStatus",
  "status",
  "actions",
]

function RecordsManagement() {
  const { t } = useTranslation()
  const initialView = Route.useSearch().view
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>(initialView ?? "residents")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "active" | "archived" | "all"
  >("active")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [archiveTarget, setArchiveTarget] = useState<ResidentPublic | null>(
    null,
  )
  const [restoreTarget, setRestoreTarget] = useState<ResidentPublic | null>(
    null,
  )
  const [notice, setNotice] = useState("")
  const [errorNotice, setErrorNotice] = useState("")
  const [selectedResident, setSelectedResident] =
    useState<ResidentPublic | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formResident, setFormResident] = useState<ResidentPublic | null>(null)
  const [profileTab, setProfileTab] = useState("Details")
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)

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

  const streetsQuery = useQuery({
    queryKey: ["lookups", "streets"],
    queryFn: async () => (await LookupsService.listStreets()).data,
  })
  const sectorsQuery = useQuery({
    queryKey: ["lookups", "sectors"],
    queryFn: async () => (await LookupsService.listSectors()).data,
  })
  const documentTypesQuery = useQuery({
    queryKey: ["lookups", "document-types"],
    queryFn: async () => (await LookupsService.listDocumentTypes()).data,
  })
  const streets = streetsQuery.data ?? []
  const sectors = sectorsQuery.data ?? []
  const streetNames = streetNameMap(streets)

  const residentsQuery = useQuery({
    queryKey: ["residents", debouncedSearch, statusFilter, pageIndex, pageSize],
    queryFn: async () =>
      (
        await ResidentsService.listResidents({
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
  const residents = residentsQuery.data?.data ?? []
  const total = residentsQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? pageIndex * pageSize + 1 : 0
  const end = Math.min((pageIndex + 1) * pageSize, total)

  // Residents whose latest Barangay ID is still usable (valid, or valid but expiring soon).
  const validIdQuery = useQuery({
    queryKey: ["barangay-id-count", "valid"],
    queryFn: async () =>
      (
        await BarangayIdsService.idsListBarangayIds({
          query: { status: "valid", limit: 1 },
        })
      ).data.count,
  })
  const soonIdQuery = useQuery({
    queryKey: ["barangay-id-count", "expiring_soon"],
    queryFn: async () =>
      (
        await BarangayIdsService.idsListBarangayIds({
          query: { status: "expiring_soon", limit: 1 },
        })
      ).data.count,
  })
  const validIds =
    validIdQuery.data !== undefined && soonIdQuery.data !== undefined
      ? String(validIdQuery.data + soonIdQuery.data)
      : "—"

  function refreshResidents() {
    void queryClient.invalidateQueries({ queryKey: ["residents"] })
    void queryClient.invalidateQueries({ queryKey: ["barangay-id-count"] })
  }

  const archiveMutation = useMutation({
    mutationFn: async ({
      resident,
      reason,
    }: {
      resident: ResidentPublic
      reason: string
    }) =>
      (
        await ResidentsService.archiveResident({
          path: { resident_id: resident.id },
          body: { reason },
        })
      ).data,
    onSuccess: (resident) => {
      setNotice(t("records.notices.archived", { name: resident.full_name }))
      setErrorNotice("")
      refreshResidents()
    },
    onError: (error) => {
      setNotice("")
      setErrorNotice(readApiError(error).message)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (resident: ResidentPublic) =>
      (
        await ResidentsService.restoreResident({
          path: { resident_id: resident.id },
        })
      ).data,
    onSuccess: (resident) => {
      setNotice(t("records.notices.restored", { name: resident.full_name }))
      setErrorNotice("")
      refreshResidents()
    },
    onError: (error) => {
      setNotice("")
      setErrorNotice(readApiError(error).message)
    },
  })

  function openForm(resident: ResidentPublic | null) {
    setFormResident(resident)
    setFormOpen(true)
    setNotice("")
    setErrorNotice("")
  }

  const tabs: { id: View; label: string }[] = [
    { id: "residents", label: t("records.tabs.residents") },
    { id: "archived", label: t("records.tabs.archived") },
    { id: "barangay-ids", label: t("records.tabs.barangayIds") },
    { id: "family-sector", label: t("records.tabs.familySector") },
    ...(isAdmin
      ? [
          { id: "lists" as const, label: t("records.tabs.lookupLists") },
          { id: "import" as const, label: t("records.tabs.import") },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("records.title")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t("records.subtitle")}
          </p>
        </div>
        <Button className="min-h-11" onClick={() => openForm(null)}>
          <UserRound aria-hidden="true" />
          {t("records.addResident")}
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b pb-3"
        role="tablist"
        aria-label={t("records.tabsAria")}
      >
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            role="tab"
            variant={view === tab.id ? "default" : "ghost"}
            aria-selected={view === tab.id}
            onClick={() => {
              setView(tab.id)
              setNotice("")
            }}
            className="min-h-11 rounded-md px-3"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-brand"
            aria-hidden="true"
          />
          <p className="flex-1">{notice}</p>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => setNotice("")}
            aria-label={t("records.dismissMessage")}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {errorNotice && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <p className="flex-1">{errorNotice}</p>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => setErrorNotice("")}
            aria-label={t("records.dismissError")}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {view === "residents" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label={t("records.stats.records.label")}
              value={residentsQuery.data ? String(total) : "—"}
              description={t("records.stats.records.description")}
            />
            <StatCard
              icon={CreditCard}
              label={t("records.stats.validId.label")}
              value={validIds}
              description={t("records.stats.validId.description")}
            />
            <StatCard
              icon={Archive}
              label={t("records.stats.removal.label")}
              value={t("records.stats.removal.value")}
              description={t("records.stats.removal.description")}
            />
          </div>

          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
              <div>
                <h2 className="font-semibold tracking-tight">
                  {t("records.list.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("records.list.description")}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block min-w-0 flex-1 sm:max-w-sm">
                  <span className="sr-only">
                    {t("records.list.searchLabel")}
                  </span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("records.list.searchPlaceholder")}
                    className={`${inputClass} pl-9`}
                  />
                </label>
                <label htmlFor="records-status-filter" className="sm:w-44">
                  <span className="sr-only">
                    {t("records.list.statusFilterLabel")}
                  </span>
                  <Select
                    id="records-status-filter"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as "active" | "archived" | "all",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="active">
                      {t("records.list.statusActive")}
                    </option>
                    <option value="archived">
                      {t("records.list.statusArchived")}
                    </option>
                    <option value="all">{t("records.list.statusAll")}</option>
                  </Select>
                </label>
              </div>
            </div>
            {residentsQuery.isLoading ? (
              <LoadingState title={t("records.list.loading")} />
            ) : residentsQuery.isError ? (
              <ErrorState
                title={t("records.list.loadError.title")}
                description={t("records.list.loadError.description")}
                onRetry={() => residentsQuery.refetch()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {residentColumns.map((column) => (
                          <th
                            key={column}
                            className={`px-4 py-3 align-middle font-medium sm:px-5 ${column === "actions" ? "sticky right-0 bg-muted sticky-head-cell text-right" : ""}`}
                          >
                            {t(`records.list.columns.${column}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {residents.map((resident) => {
                        const archived = resident.status === "archived"
                        const statusKey = archived ? "archived" : "active"
                        const address = residentAddress(resident, streetNames)
                        return (
                          <tr
                            key={resident.id}
                            className={cn(
                              "transition-colors hover:bg-muted/30",
                              archived && "opacity-70",
                            )}
                          >
                            <td className="px-4 py-3 align-middle sm:px-5">
                              <p className="font-semibold">
                                {resident.full_name}
                              </p>
                              <p
                                className="mt-1 font-mono text-xs text-muted-foreground"
                                title={resident.id}
                              >
                                {resident.id.slice(0, 8)}…
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                              {resident.birthdate
                                ? `${formatBusinessDate(resident.birthdate)}${resident.age !== null ? ` · ${t("records.ageYears", { age: resident.age })}` : ""}`
                                : "—"}
                            </td>
                            <td
                              className="max-w-[180px] truncate px-4 py-3 align-middle sm:px-5"
                              title={address}
                            >
                              {address || "—"}
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              {resident.resident_type
                                ? residentTypeLabel(resident.resident_type, t)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              <Badge
                                variant="outline"
                                className={
                                  statusStyles[
                                    idStatusStyleKey[resident.id_status]
                                  ]
                                }
                              >
                                {t(`records.idStatus.${resident.id_status}`)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              <Badge
                                variant="outline"
                                className={
                                  statusStyles[archived ? "Archived" : "Active"]
                                }
                              >
                                {t(`records.status.${statusKey}`)}
                              </Badge>
                            </td>
                            <td className="sticky right-0 bg-card row-hover-cell px-4 py-3 align-middle sm:px-5 sticky-edge">
                              <RowActions
                                name={resident.full_name}
                                isAdmin={isAdmin}
                                primary={{
                                  label: t("records.actions.viewProfile"),
                                  variant: "outline",
                                  onSelect: () => {
                                    setSelectedResident(resident)
                                    setProfileTab("Details")
                                  },
                                }}
                                items={[
                                  {
                                    label: t("records.actions.editDetails"),
                                    hidden: archived,
                                    onSelect: () => openForm(resident),
                                  },
                                  {
                                    label: t("records.actions.newIssuance"),
                                    hidden: archived,
                                    onSelect: () =>
                                      window.location.assign(
                                        `/issuances?resident=${encodeURIComponent(resident.id)}`,
                                      ),
                                  },
                                  {
                                    label: t("records.actions.archive"),
                                    adminOnly: true,
                                    hidden: archived,
                                    destructive: true,
                                    onSelect: () => setArchiveTarget(resident),
                                  },
                                  {
                                    label: t("records.actions.restore"),
                                    adminOnly: true,
                                    hidden: !archived,
                                    onSelect: () => setRestoreTarget(resident),
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {residents.length === 0 ? (
                    <EmptyState
                      title={t("records.list.empty.title")}
                      description={t("records.list.empty.description")}
                      action={
                        search.trim() !== "" || statusFilter !== "active" ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            onClick={() => {
                              setSearch("")
                              setStatusFilter("active")
                            }}
                          >
                            {t("issuances.history.resetFilters")}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            className="min-h-11"
                            onClick={() => openForm(null)}
                          >
                            <UserRound aria-hidden="true" />
                            {t("records.addResident")}
                          </Button>
                        )
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
      )}

      {view === "archived" && (
        <ArchivedResidentsView
          isAdmin={isAdmin}
          onViewProfile={(resident) => {
            setSelectedResident(resident)
            setProfileTab("Details")
          }}
          onRestore={setRestoreTarget}
        />
      )}

      {view === "barangay-ids" && <BarangayIdsView />}

      {view === "lists" && isAdmin && <LookupListsView />}

      {view === "family-sector" && (
        <FamilySectorView
          streets={streetNames}
          onViewProfile={(resident) => {
            setSelectedResident(resident)
            setProfileTab("Family & Sector")
          }}
        />
      )}

      {view === "import" && isAdmin && <ImportMasterlistView />}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null)
        }}
        title={t("records.archiveDialog.title")}
        description={
          archiveTarget
            ? t("records.archiveDialog.description", {
                name: archiveTarget.full_name,
              })
            : t("records.archiveDialog.fallback")
        }
        confirmLabel={t("records.archiveDialog.confirm")}
        destructive
        reason="required"
        onConfirm={(reason) => {
          if (!archiveTarget) return
          archiveMutation.mutate({
            resident: archiveTarget,
            reason: reason.trim(),
          })
          setArchiveTarget(null)
        }}
      />
      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null)
        }}
        title={t("records.restoreDialog.title")}
        description={
          restoreTarget
            ? t("records.restoreDialog.description", {
                name: restoreTarget.full_name,
              })
            : t("records.restoreDialog.fallback")
        }
        confirmLabel={t("records.restoreDialog.confirm")}
        onConfirm={() => {
          if (!restoreTarget) return
          restoreMutation.mutate(restoreTarget)
          setRestoreTarget(null)
        }}
      />
      <ResidentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        resident={formResident}
        streets={streets}
        sectors={sectors}
        onSaved={(saved, mode, photoError) => {
          setFormOpen(false)
          const savedMessage =
            mode === "created"
              ? t("records.notices.added", { name: saved.full_name })
              : mode === "unchanged"
                ? t("records.notices.unchanged", { name: saved.full_name })
                : t("records.notices.updated", { name: saved.full_name })
          setNotice(
            photoError
              ? t("records.notices.photoFailed", {
                  message: savedMessage,
                  error: photoError,
                })
              : savedMessage,
          )
          setErrorNotice("")
          setSelectedResident((current) =>
            current && current.id === saved.id ? saved : current,
          )
          refreshResidents()
        }}
      />
      <ResidentProfileDialog
        resident={selectedResident}
        onOpenChange={(open) => {
          if (!open) setSelectedResident(null)
        }}
        profileTab={profileTab}
        onProfileTabChange={setProfileTab}
        streets={streetNames}
        sectors={sectors}
        documentTypes={documentTypesQuery.data ?? []}
        onEdit={() => {
          if (selectedResident) openForm(selectedResident)
        }}
      />
    </div>
  )
}
