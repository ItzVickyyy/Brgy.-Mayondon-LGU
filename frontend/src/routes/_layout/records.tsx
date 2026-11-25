import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Archive,
  CreditCard,
  Eye,
  FilePlus2,
  Pencil,
  Search,
  UserRound,
  Users,
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
import {
  PageCheckbox,
  RowCheckbox,
  SelectionBar,
} from "@/components/Common/SelectionControls"
import { StatCard } from "@/components/Common/StatCard"
import { TablePagination } from "@/components/Common/TablePagination"
import { ArchivedResidentsView } from "@/components/Records/ArchivedResidentsView"
import { BarangayIdsView } from "@/components/Records/BarangayIdsView"
import { ImportMasterlistView } from "@/components/Records/ImportMasterlistView"
import { ResidentFormDialog } from "@/components/Records/ResidentFormDialog"
import { ResidentProfileDialog } from "@/components/Records/ResidentProfileDialog"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { isSystemAdministrator } from "@/lib/access"
import { notify } from "@/lib/notifications"
import { civilStatusLabel, sexLabel } from "@/lib/residentLabels"
import {
  formatBusinessDate,
  readApiError,
  residentAddress,
  streetNameMap,
} from "@/lib/residents"
import { useRowSelection } from "@/lib/useRowSelection"

export const Route = createFileRoute("/_layout/records")({
  component: RecordsManagement,
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: "barangay-ids"; q?: string } => ({
    ...(search.view === "barangay-ids"
      ? { view: "barangay-ids" as const }
      : {}),
    // Ctrl+K hands over the name to look for.
    ...(typeof search.q === "string" && search.q.trim()
      ? { q: search.q.trim().slice(0, 100) }
      : {}),
  }),
  head: () => ({ meta: [{ title: pageTitle("Records Management") }] }),
})

type View = "residents" | "archived" | "barangay-ids" | "import"

const inputClass = formControlClass

type ResidentColumn =
  | "resident"
  | "address"
  | "birthdate"
  | "sex"
  | "civilStatus"
  | "occupation"
  | "actions"

const residentColumns: ResidentColumn[] = [
  "resident",
  "address",
  "birthdate",
  "sex",
  "civilStatus",
  "occupation",
  "actions",
]

// Records list at narrow widths (container queries on the table's own box, so the
// sidebar is accounted for): from 59rem all seven columns; from 47rem Civil status
// and Occupation (optional, never printed) drop out; below 47rem every row is a card.
const cardCell = "@max-[47rem]/records:block @max-[47rem]/records:p-0"
function optionalColumn(column: ResidentColumn) {
  return column === "civilStatus" || column === "occupation"
    ? "hidden @[59rem]/records:table-cell"
    : ""
}

function RecordsManagement() {
  const { t } = useTranslation()
  const { view: initialView, q: initialQuery } = Route.useSearch()
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>(initialView ?? "residents")
  const [search, setSearch] = useState(initialQuery ?? "")
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery ?? "")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [archiveTarget, setArchiveTarget] = useState<ResidentPublic | null>(
    null,
  )
  const [restoreTarget, setRestoreTarget] = useState<ResidentPublic | null>(
    null,
  )
  const { showErrorToast } = useCustomToast()
  const [selectedResident, setSelectedResident] =
    useState<ResidentPublic | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formResident, setFormResident] = useState<ResidentPublic | null>(null)
  const [profileTab, setProfileTab] = useState("Details")
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)

  // Ctrl+K while already on this page: show the person that was picked.
  useEffect(() => {
    if (initialQuery === undefined) return
    setSearch(initialQuery)
    setView("residents")
  }, [initialQuery])

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
  }, [debouncedSearch])

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
    queryKey: ["residents", debouncedSearch, pageIndex, pageSize],
    queryFn: async () =>
      (
        await ResidentsService.listResidents({
          query: {
            q: debouncedSearch || undefined,
            status: "active",
            skip: pageIndex * pageSize,
            limit: pageSize,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const residents = residentsQuery.data?.data ?? []
  const total = residentsQuery.data?.count ?? 0
  // Server pages: a selection lasts only while its rows are on screen.
  const pick = useRowSelection(residents, (resident) => String(resident.id))
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
      notify({ key: "records.notices.archivedStored" }, "success", {
        toastText: t("records.notices.archived", { name: resident.full_name }),
      })
      refreshResidents()
    },
    onError: (error) => {
      showErrorToast(readApiError(error).message)
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
      notify({ key: "records.notices.restoredStored" }, "success", {
        toastText: t("records.notices.restored", { name: resident.full_name }),
      })
      refreshResidents()
    },
    onError: (error) => {
      showErrorToast(readApiError(error).message)
    },
  })

  function openForm(resident: ResidentPublic | null) {
    setFormResident(resident)
    setFormOpen(true)
  }

  const tabs: { id: View; label: string }[] = [
    { id: "residents", label: t("records.tabs.residents") },
    { id: "archived", label: t("records.tabs.archived") },
    { id: "barangay-ids", label: t("records.tabs.barangayIds") },
    ...(isAdmin
      ? [{ id: "import" as const, label: t("records.tabs.import") }]
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
        <Button
          variant="cta"
          size="cta"
          data-shortcut="new-resident"
          title={t("common.dialogs.shortcutHint", { key: "N" })}
          onClick={() => openForm(null)}
        >
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
            }}
            className="min-h-11 rounded-md px-3"
          >
            {tab.label}
          </Button>
        ))}
      </div>

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
                <SelectionBar
                  count={pick.count}
                  onClear={pick.clear}
                  csvName="residents-selected.csv"
                  csvRows={() => [
                    residentColumns
                      .filter((column) => column !== "actions")
                      .map((column) => t(`records.list.columns.${column}`)),
                    ...pick
                      .pick(residents)
                      .map((resident) => [
                        `${resident.full_name} (${resident.id_number || "—"})`,
                        residentAddress(resident, streetNames) || "—",
                        resident.birthdate
                          ? formatBusinessDate(resident.birthdate)
                          : "—",
                        resident.sex ? sexLabel(resident.sex, t) : "—",
                        resident.civil_status
                          ? civilStatusLabel(resident.civil_status, t)
                          : "—",
                        resident.occupation || "—",
                      ]),
                  ]}
                />
                <div className="@container/records overflow-x-auto">
                  <table className="w-full text-left text-sm @max-[47rem]/records:block @[47rem]/records:min-w-[720px] @[59rem]/records:min-w-[900px]">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground @max-[47rem]/records:hidden">
                      <tr>
                        <th className="w-7 px-1 py-3 align-middle">
                          <PageCheckbox
                            all={pick.allOnPage}
                            some={pick.someOnPage}
                            onChange={pick.togglePage}
                          />
                        </th>
                        {residentColumns.map((column) => (
                          <th
                            key={column}
                            className={`px-2 py-3 align-middle font-medium ${column === "actions" ? "sticky right-0 bg-muted sticky-head-cell text-center" : ""} ${optionalColumn(column)}`}
                          >
                            {t(`records.list.columns.${column}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y @max-[47rem]/records:block">
                      {residents.map((resident) => {
                        const address = residentAddress(resident, streetNames)
                        return (
                          <tr
                            key={resident.id}
                            className="transition-colors hover:bg-muted/30 @max-[47rem]/records:relative @max-[47rem]/records:flex @max-[47rem]/records:flex-wrap @max-[47rem]/records:gap-x-3 @max-[47rem]/records:gap-y-1 @max-[47rem]/records:px-4 @max-[47rem]/records:py-3"
                          >
                            <td className="w-7 px-1 py-3 align-middle @max-[47rem]/records:absolute @max-[47rem]/records:right-2 @max-[47rem]/records:top-2 @max-[47rem]/records:block @max-[47rem]/records:w-auto @max-[47rem]/records:p-0">
                              <RowCheckbox
                                label={resident.full_name}
                                checked={pick.isSelected(String(resident.id))}
                                onChange={() =>
                                  pick.toggle(String(resident.id))
                                }
                              />
                            </td>
                            <td
                              className={`px-2 py-3 align-middle ${cardCell} @max-[47rem]/records:w-full @max-[47rem]/records:pr-9`}
                            >
                              <p className="font-semibold">
                                {resident.full_name}
                              </p>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">
                                {resident.id_number || "—"}
                              </p>
                            </td>
                            <td
                              className={`px-2 py-3 align-middle ${cardCell} @max-[47rem]/records:w-full`}
                              title={address}
                            >
                              <div className="line-clamp-2 max-w-[8rem] break-words @max-[47rem]/records:max-w-none">
                                {address || "—"}
                              </div>
                            </td>
                            <td
                              className={`px-2 py-3 align-middle ${cardCell}`}
                            >
                              {resident.birthdate ? (
                                <>
                                  <span className="whitespace-nowrap">
                                    {formatBusinessDate(resident.birthdate)}
                                  </span>
                                  {resident.age !== null ? (
                                    <>
                                      {" · "}
                                      <span className="whitespace-nowrap">
                                        {t("records.ageYears", {
                                          age: resident.age,
                                        })}
                                      </span>
                                    </>
                                  ) : null}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td
                              className={`px-2 py-3 align-middle ${cardCell}`}
                            >
                              {resident.sex ? sexLabel(resident.sex, t) : "—"}
                            </td>
                            <td
                              className={`px-2 py-3 align-middle ${optionalColumn("civilStatus")}`}
                            >
                              {resident.civil_status
                                ? civilStatusLabel(resident.civil_status, t)
                                : "—"}
                            </td>
                            <td
                              className={`max-w-[5rem] truncate px-2 py-3 align-middle ${optionalColumn("occupation")}`}
                              title={resident.occupation ?? undefined}
                            >
                              {resident.occupation || "—"}
                            </td>
                            <td
                              className={`sticky right-0 bg-card row-hover-cell px-2 py-3 align-middle sticky-edge ${cardCell} @max-[47rem]/records:static @max-[47rem]/records:w-full @max-[47rem]/records:bg-transparent`}
                            >
                              <RowActions
                                compact
                                className="@max-[47rem]/records:flex-wrap @max-[47rem]/records:justify-start"
                                name={resident.full_name}
                                isAdmin={isAdmin}
                                primary={{
                                  label: t("records.actions.viewProfile"),
                                  variant: "tintTeal",
                                  icon: (
                                    <Eye
                                      aria-hidden="true"
                                      className="max-2xl:hidden"
                                    />
                                  ),
                                  onSelect: () => {
                                    setSelectedResident(resident)
                                    setProfileTab("Details")
                                  },
                                }}
                                actions={[
                                  {
                                    label: t("records.actions.editDetails"),
                                    variant: "tintBlue",
                                    icon: (
                                      <Pencil
                                        aria-hidden="true"
                                        className="max-2xl:hidden"
                                      />
                                    ),
                                    onSelect: () => openForm(resident),
                                  },
                                  {
                                    label: t("records.actions.newIssuance"),
                                    variant: "tintGreen",
                                    icon: (
                                      <FilePlus2
                                        aria-hidden="true"
                                        className="max-2xl:hidden"
                                      />
                                    ),
                                    onSelect: () =>
                                      window.location.assign(
                                        `/issuances?resident=${encodeURIComponent(resident.id)}`,
                                      ),
                                  },
                                ]}
                                items={[
                                  {
                                    label: t("records.actions.archive"),
                                    icon: (
                                      <Archive
                                        aria-hidden="true"
                                        className="size-4"
                                      />
                                    ),
                                    adminOnly: true,
                                    destructive: true,
                                    onSelect: () => setArchiveTarget(resident),
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
                        search.trim() !== "" ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            onClick={() => {
                              setSearch("")
                            }}
                          >
                            {t("issuances.history.resetFilters")}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="cta"
                            size="cta"
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
        onSaved={(saved, mode, photoError, proofError) => {
          setFormOpen(false)
          const savedKey =
            mode === "created"
              ? "added"
              : mode === "unchanged"
                ? "unchanged"
                : "updated"
          // The toast names the resident and gives the upload errors; the
          // saved notice has neither (errors can hold file names or paths).
          const compose = (base: string, stored: boolean) => {
            const withProof = proofError
              ? t(
                  stored
                    ? "records.notices.proofFailedStored"
                    : "records.notices.proofFailed",
                  { message: base, error: proofError },
                )
              : base
            return photoError
              ? t(
                  stored
                    ? "records.notices.photoFailedStored"
                    : "records.notices.photoFailed",
                  { message: withProof, error: photoError },
                )
              : withProof
          }
          notify(
            compose(t(`records.notices.${savedKey}Stored`), true),
            photoError || proofError ? "warning" : "success",
            {
              toastText: compose(
                t(`records.notices.${savedKey}`, { name: saved.full_name }),
                false,
              ),
            },
          )
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
