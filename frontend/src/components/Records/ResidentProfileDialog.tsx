import { useQuery } from "@tanstack/react-query"
import { CreditCard, FileCheck2, UserRound, Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  IssuancesService,
  type LookupItem,
  type ResidentPublic,
} from "@/client"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { statusStyles } from "@/components/Common/statusStyles"
import { issuanceApi } from "@/components/Issuances/NewIssuance/issuanceApi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  civilStatusLabel,
  residentTypeLabel,
  sexLabel,
} from "@/lib/residentLabels"
import { formatBusinessDate, residentAddress } from "@/lib/residents"

type ResidentProfileDialogProps = {
  resident: ResidentPublic | null
  onOpenChange: (open: boolean) => void
  profileTab: string
  onProfileTabChange: (tab: string) => void
  streets: Map<number, string>
  sectors: LookupItem[]
  documentTypes: LookupItem[]
  /** Shown only for an active resident; opens the edit form. */
  onEdit?: () => void
}

// statusStyles is keyed by the capitalised English status word.
const statusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1)

// Profile tabs: the id is kept in English because records.tsx stores it;
// only the shown label is translated.
const profileTabs = [
  { id: "Details", labelKey: "records.profile.tabs.details" },
  { id: "Family & Sector", labelKey: "records.profile.tabs.familySector" },
  { id: "Barangay ID", labelKey: "records.profile.tabs.barangayId" },
  { id: "Issuance History", labelKey: "records.profile.tabs.issuanceHistory" },
] as const

const historyColumns = ["reference", "document", "issueDate", "status"] as const

export function ResidentProfileDialog({
  resident,
  onOpenChange,
  profileTab,
  onProfileTabChange,
  streets,
  sectors,
  documentTypes,
  onEdit,
}: ResidentProfileDialogProps) {
  const { t } = useTranslation()
  const voterLabel = (value: string | null | undefined) =>
    value === "registered"
      ? t("records.profile.voter.registered")
      : value === "unregistered"
        ? t("records.profile.voter.unregistered")
        : "—"
  const recordStatusText = (status: string) =>
    status === "archived"
      ? t("records.status.archived")
      : status === "active"
        ? t("records.status.active")
        : statusLabel(status)
  const historyStatusText = (status: string) =>
    status === "draft" || status === "issued" || status === "voided"
      ? t(`records.profile.history.status.${status}`)
      : statusLabel(status)
  const historyQuery = useQuery({
    queryKey: ["resident-issuances", resident?.id],
    queryFn: async () =>
      (
        await IssuancesService.listIssuances({
          query: { resident_id: resident?.id, status: "all", limit: 50 },
        })
      ).data,
    enabled: Boolean(resident) && profileTab === "Issuance History",
  })

  const photoQuery = useQuery({
    queryKey: ["resident-photo", resident?.id],
    queryFn: async () =>
      resident ? issuanceApi.loadResidentPhoto(resident.id) : undefined,
    enabled: Boolean(resident?.has_photo) && profileTab === "Details",
    staleTime: 0,
  })
  const documentName = new Map(
    documentTypes.map((item) => [item.id, item.name]),
  )
  const sectorNames = resident
    ? resident.sector_ids.map(
        (id) => sectors.find((sector) => sector.id === id)?.name ?? `#${id}`,
      )
    : []
  const archived = resident?.status === "archived"

  const details: [string, string][] = resident
    ? [
        [t("records.profile.fields.reference"), resident.id],
        [t("records.profile.fields.fullName"), resident.full_name],
        [
          t("records.profile.fields.birthdateAge"),
          resident.birthdate
            ? `${formatBusinessDate(resident.birthdate)}${resident.age !== null ? ` · ${t("records.ageYears", { age: resident.age })}` : ""}`
            : "—",
        ],
        [t("records.profile.fields.birthPlace"), resident.birth_place || "—"],
        [
          t("records.profile.fields.sex"),
          resident.sex ? sexLabel(resident.sex, t) : "—",
        ],
        [
          t("records.profile.fields.civilStatus"),
          resident.civil_status
            ? civilStatusLabel(resident.civil_status, t)
            : "—",
        ],
        [
          t("records.profile.fields.address"),
          residentAddress(resident, streets) || "—",
        ],
        [
          t("records.profile.fields.residentSince"),
          resident.resident_since_birth
            ? t("records.profile.fields.sinceBirth")
            : resident.resident_since_year
              ? String(resident.resident_since_year)
              : "—",
        ],
        [
          t("records.profile.fields.residentType"),
          resident.resident_type
            ? residentTypeLabel(resident.resident_type, t)
            : "—",
        ],
        [
          t("records.profile.fields.voter"),
          voterLabel(resident.voter_registration),
        ],
        [
          t("records.profile.fields.emergency"),
          resident.emergency_contact_name || "—",
        ],
        [
          t("records.profile.fields.emergencyAddress"),
          resident.emergency_contact_address || "—",
        ],
        [
          t("records.profile.fields.emergencyPhone"),
          resident.emergency_contact_phone || "—",
        ],
        [
          t("records.profile.fields.photo"),
          resident.has_photo
            ? t("records.profile.fields.photoOnFile")
            : t("records.profile.fields.photoNone"),
        ],
        [
          t("records.profile.fields.recordStatus"),
          recordStatusText(resident.status),
        ],
        ...(archived && resident.archive_reason
          ? ([
              [
                t("records.profile.fields.archiveReason"),
                resident.archive_reason,
              ],
            ] as [string, string][])
          : []),
      ]
    : []

  return (
    <Dialog open={Boolean(resident)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t("records.profile.title")}
          </DialogTitle>
          <DialogDescription>
            {t("records.profile.description")}
          </DialogDescription>
        </DialogHeader>
        {resident ? (
          <>
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <UserRound className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{resident.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {residentAddress(resident, streets) ||
                    t("records.profile.noAddress")}
                </p>
              </div>
              <Badge
                variant="outline"
                className={statusStyles[statusLabel(resident.status)]}
              >
                {recordStatusText(resident.status)}
              </Badge>
            </div>
            <div
              className="flex flex-wrap gap-2 border-b pb-3"
              role="tablist"
              aria-label={t("records.profile.tabsAria")}
            >
              {profileTabs.map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  role="tab"
                  variant={profileTab === tab.id ? "default" : "ghost"}
                  aria-selected={profileTab === tab.id}
                  onClick={() => onProfileTabChange(tab.id)}
                  className="min-h-11 rounded-md px-3"
                >
                  {t(tab.labelKey)}
                </Button>
              ))}
            </div>

            {profileTab === "Details" ? (
              <>
                {resident?.has_photo ? (
                  <div className="mb-3 flex items-center gap-4 rounded-xl border bg-card p-4">
                    {photoQuery.data ? (
                      <img
                        src={photoQuery.data}
                        alt={t("records.profile.photoCard.alt", {
                          name: resident.full_name,
                        })}
                        className="h-24 w-20 rounded-md border bg-white object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-20 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                        {photoQuery.isLoading
                          ? t("records.profile.photoCard.loading")
                          : t("records.profile.photoCard.unavailable")}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">
                        {t("records.profile.photoCard.title")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("records.profile.photoCard.description")}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {details.map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-card p-4">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-1 break-words font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {profileTab === "Family & Sector" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <UserRound className="size-5 text-brand" aria-hidden="true" />
                  <h3 className="mt-2 font-semibold">
                    {t("records.profile.family.sectorsTitle")}
                  </h3>
                  {sectorNames.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {sectorNames.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("records.profile.family.noSector")}
                    </p>
                  )}
                </section>
                <section className="rounded-xl border bg-card p-4">
                  <Users className="size-5 text-brand" aria-hidden="true" />
                  <h3 className="mt-2 font-semibold">
                    {t("records.profile.family.familyTitle")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("records.profile.family.familyDescription")}
                  </p>
                </section>
              </div>
            ) : null}

            {profileTab === "Barangay ID" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <CreditCard
                    className="size-5 text-brand"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("records.profile.id.number")}
                  </p>
                  <p className="mt-1 font-semibold">
                    {resident.id_number || t("records.profile.id.none")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("records.profile.id.note")}
                  </p>
                </section>
                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    {t("records.profile.fields.voter")}
                  </p>
                  <p className="mt-1 font-semibold">
                    {voterLabel(resident.voter_registration)}
                  </p>
                </section>
              </div>
            ) : null}

            {profileTab === "Issuance History" ? (
              <section className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <FileCheck2
                    className="size-6 text-brand"
                    aria-hidden="true"
                  />
                  <h3 className="font-semibold">
                    {t("records.profile.history.title")}
                  </h3>
                </div>
                {historyQuery.isLoading ? (
                  <LoadingState title={t("records.profile.history.loading")} />
                ) : historyQuery.isError ? (
                  <ErrorState
                    title={t("records.profile.history.loadError")}
                    onRetry={() => historyQuery.refetch()}
                  />
                ) : historyQuery.data && historyQuery.data.data.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          {historyColumns.map((column) => (
                            <th key={column} className="py-2 pr-4 font-medium">
                              {t(`records.profile.history.columns.${column}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {historyQuery.data.data.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 pr-4 font-mono">
                              {item.reference_no ??
                                t("records.profile.history.draft")}
                            </td>
                            <td className="py-2 pr-4">
                              {documentName.get(item.document_type_id) ??
                                item.document_type_code}
                            </td>
                            <td className="py-2 pr-4">
                              {formatBusinessDate(item.issue_date)}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge
                                variant="outline"
                                className={
                                  statusStyles[statusLabel(item.status)]
                                }
                              >
                                {historyStatusText(item.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={t("records.profile.history.empty.title")}
                    description={t("records.profile.history.empty.description")}
                  />
                )}
              </section>
            ) : null}

            {onEdit && !archived && profileTab === "Details" ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={onEdit}>
                  {t("records.profile.edit")}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
