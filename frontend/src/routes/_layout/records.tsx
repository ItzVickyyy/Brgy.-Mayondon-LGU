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
  FileUp,
  Search,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
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
import { StatCard } from "@/components/Common/StatCard"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { BarangayIdsView } from "@/components/Records/BarangayIdsView"
import { ResidentFormDialog } from "@/components/Records/ResidentFormDialog"
import { ResidentProfileDialog } from "@/components/Records/ResidentProfileDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
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

type View = "residents" | "barangay-ids" | "family-sector" | "import"

const inputClass = formControlClass
const PAGE_SIZE = 10

function RecordsManagement() {
  const initialView = Route.useSearch().view
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>(initialView ?? "residents")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "active" | "archived" | "all"
  >("active")
  const [pageIndex, setPageIndex] = useState(0)
  const [archiveTarget, setArchiveTarget] = useState<ResidentPublic | null>(
    null,
  )
  const [restoreTarget, setRestoreTarget] = useState<ResidentPublic | null>(
    null,
  )
  const [notice, setNotice] = useState("")
  const [errorNotice, setErrorNotice] = useState("")
  const [selectedFile, setSelectedFile] = useState("")
  const [importStep, setImportStep] = useState(0)
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
    queryKey: ["residents", debouncedSearch, statusFilter, pageIndex],
    queryFn: async () =>
      (
        await ResidentsService.listResidents({
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
  const residents = residentsQuery.data?.data ?? []
  const total = residentsQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total ? pageIndex * PAGE_SIZE + 1 : 0
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, total)

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
      setNotice(`${resident.full_name} was archived.`)
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
      setNotice(`${resident.full_name} was restored.`)
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
    { id: "residents", label: "Residents" },
    { id: "barangay-ids", label: "Barangay IDs" },
    { id: "family-sector", label: "Family & Sector Details" },
    ...(isAdmin ? [{ id: "import" as const, label: "Import Masterlist" }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Records Management
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Search and maintain resident information, family and sector details,
            and Barangay ID records. New and renewed IDs are issued from
            Issuance Management.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => openForm(null)}>
          <UserRound aria-hidden="true" />
          Add Resident
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b pb-3"
        role="tablist"
        aria-label="Records Management views"
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
            aria-label="Dismiss message"
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
            aria-label="Dismiss error"
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
              label="Resident Records"
              value={residentsQuery.data ? String(total) : "—"}
              description="Matching the current search and filter"
            />
            <StatCard
              icon={CreditCard}
              label="Residents with Valid ID"
              value={validIds}
              description="Latest Barangay ID is still valid"
            />
            <StatCard
              icon={Archive}
              label="Record Removal"
              value="Archive"
              description="Prefer inactive status over permanent deletion"
            />
          </div>

          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
              <div>
                <h2 className="font-semibold tracking-tight">Resident List</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Find a resident, confirm identity, and choose the next action.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block min-w-0 flex-1 sm:max-w-sm">
                  <span className="sr-only">Search resident records</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, address, or ID number..."
                    className={`${inputClass} pl-9`}
                  />
                </label>
                <label className="sm:w-44">
                  <span className="sr-only">Filter by record status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as "active" | "archived" | "all",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="all">All statuses</option>
                  </select>
                </label>
              </div>
            </div>
            {residentsQuery.isLoading ? (
              <LoadingState title="Loading residents..." />
            ) : residentsQuery.isError ? (
              <ErrorState
                title="Could not load residents"
                description="Check your connection and try again."
                onRetry={() => residentsQuery.refetch()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {[
                          "Resident",
                          "Birthdate / Age",
                          "Address",
                          "Resident type",
                          "Barangay ID",
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
                      {residents.map((resident) => {
                        const archived = resident.status === "archived"
                        const statusText = archived ? "Archived" : "Active"
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
                                ? `${formatBusinessDate(resident.birthdate)}${resident.age !== null ? ` · ${resident.age} yrs` : ""}`
                                : "—"}
                            </td>
                            <td
                              className="max-w-[220px] truncate px-4 py-3 align-middle sm:px-5"
                              title={address}
                            >
                              {address || "—"}
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              {resident.resident_type || "—"}
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              {resident.id_number ? (
                                <span className="font-mono">
                                  {resident.id_number}
                                </span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={statusStyles.None}
                                >
                                  None
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              <Badge
                                variant="outline"
                                className={statusStyles[statusText]}
                              >
                                {statusText}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 align-middle sm:px-5">
                              <RowActions
                                name={resident.full_name}
                                isAdmin={isAdmin}
                                primary={{
                                  label: "View profile",
                                  variant: "outline",
                                  onSelect: () => {
                                    setSelectedResident(resident)
                                    setProfileTab("Details")
                                  },
                                }}
                                items={[
                                  {
                                    label: "Edit details",
                                    hidden: archived,
                                    onSelect: () => openForm(resident),
                                  },
                                  {
                                    label: "New issuance",
                                    hidden: archived,
                                    onSelect: () =>
                                      window.location.assign(
                                        `/issuances?resident=${encodeURIComponent(resident.id)}`,
                                      ),
                                  },
                                  {
                                    label: "Archive",
                                    adminOnly: true,
                                    hidden: archived,
                                    destructive: true,
                                    onSelect: () => setArchiveTarget(resident),
                                  },
                                  {
                                    label: "Restore from archive",
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
                      title="No matching residents"
                      description="Try a different name, address, ID number, or filter."
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
      )}

      {view === "barangay-ids" && <BarangayIdsView onNotice={setNotice} />}

      {view === "family-sector" && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold tracking-tight">
                Family, Beneficiary, and Marginalized-Sector Details
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Manage family and sector details associated with resident
                records.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Family Details",
                description:
                  "Household reference, family members, and relationships.",
                icon: Users,
                action: "Manage family details",
              },
              {
                title: "Beneficiary Details",
                description:
                  "Beneficiary information used by approved barangay forms.",
                icon: UserRound,
                action: "Manage beneficiaries",
              },
              {
                title: "Marginalized-Sector Details",
                description:
                  "Sector classifications associated with resident records.",
                icon: FileUp,
                action: "Manage sector details",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="flex min-h-36 flex-col rounded-xl border bg-background p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 min-h-11 self-start"
                  onClick={() => setNotice(`${item.action} screen selected.`)}
                >
                  {item.action}
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === "import" && isAdmin && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
              <FileUp className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">Import Existing Masterlist</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Prepare a controlled import from client-provided spreadsheets.
                Validate the file and preview changes before anything is saved.
              </p>
            </div>
          </div>
          <fieldset
            className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label="Masterlist import steps"
          >
            {["Select file", "Map columns", "Preview", "Results"].map(
              (label, index) => (
                <Button
                  key={label}
                  type="button"
                  variant={importStep === index ? "default" : "outline"}
                  className="min-h-11"
                  aria-current={importStep === index ? "step" : undefined}
                  onClick={() => setImportStep(index)}
                >
                  {index + 1}. {label}
                </Button>
              ),
            )}
          </fieldset>
          {importStep === 0 ? (
            <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:border-brand/50 hover:bg-muted/30">
              <Upload className="size-7 text-brand" aria-hidden="true" />
              <span className="font-semibold">
                {selectedFile || "Choose a masterlist file"}
              </span>
              <span className="text-sm text-muted-foreground">
                Supported formats: CSV, XLSX, XLS
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0]?.name ?? "")
                  setNotice("")
                }}
              />
            </label>
          ) : null}
          {importStep === 1 ? (
            <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
              <h3 className="font-semibold">Map spreadsheet columns</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Match each resident field to a column in the selected
                masterlist.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Full name",
                  "Complete address",
                  "Resident type",
                  "Barangay ID number",
                ].map((field) => (
                  <label
                    key={field}
                    className="flex flex-col gap-2 text-sm font-medium"
                  >
                    {field}
                    <select className={cn(inputClass, "font-normal")}>
                      <option>Choose source column</option>
                      <option>Name</option>
                      <option>Address</option>
                      <option>Resident Type</option>
                      <option>ID Number</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {importStep === 2 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <div className="border-b p-4">
                <h3 className="font-semibold">Preview before import</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review the mapped fields and validation summary before
                  confirming.
                </p>
              </div>
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Field", "Source column", "Validation"].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-3 align-middle font-medium sm:px-5"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Full name", "Name", "Required"],
                    ["Complete address", "Address", "Review format"],
                    ["Resident type", "Resident Type", "Check allowed values"],
                    ["Barangay ID number", "ID Number", "Check duplicates"],
                  ].map((row) => (
                    <tr
                      key={row[0]}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 align-middle font-medium sm:px-5">
                        {row[0]}
                      </td>
                      <td className="px-4 py-3 align-middle sm:px-5">
                        {row[1]}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row[2]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {importStep === 3 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Imported", "Pending"],
                ["Updated", "Pending"],
                ["Skipped", "Pending"],
                ["Failed", "Pending"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-between gap-3 border-t pt-4">
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              disabled={importStep === 0}
              onClick={() => setImportStep((step) => Math.max(0, step - 1))}
            >
              Previous step
            </Button>
            <Button
              className="min-h-11"
              type="button"
              disabled={importStep === 3 || (importStep === 0 && !selectedFile)}
              onClick={() => setImportStep((step) => Math.min(3, step + 1))}
            >
              {importStep === 2 ? "Review results" : "Continue"}
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null)
        }}
        title="Archive resident record?"
        description={
          archiveTarget
            ? `Archive ${archiveTarget.full_name}? The record will remain in history.`
            : "Confirm archive."
        }
        confirmLabel="Archive record"
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
        title="Restore resident record?"
        description={
          restoreTarget
            ? `Restore ${restoreTarget.full_name} to active records?`
            : "Confirm restore."
        }
        confirmLabel="Restore record"
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
        onSaved={(saved, mode) => {
          setFormOpen(false)
          setNotice(
            mode === "created"
              ? `${saved.full_name} was added.`
              : `${saved.full_name} was updated.`,
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
