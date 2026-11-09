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
import {
  modalBody,
  modalHeader,
  modalShell,
  modalTall,
} from "@/components/Common/ModalLayout"
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
import { documentTypeLabel } from "@/lib/issuanceLabels"
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
    enabled: Boolean(resident?.has_photo),
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

  const dash = "—"
  // Only what staff need to read; the name, photo and record status are
  // already in the card above, and the internal reference is not shown.
  const detailSections: { title: string; rows: [string, string][] }[] =
    resident
      ? [
          {
            title: t("records.form.sections.personal"),
            rows: [
              [
                t("records.profile.fields.birthdateAge"),
                resident.birthdate
                  ? `${formatBusinessDate(resident.birthdate)}${resident.age !== null ? ` · ${t("records.ageYears", { age: resident.age })}` : ""}`
                  : dash,
              ],
              [
                t("records.profile.fields.birthPlace"),
                resident.birth_place || dash,
              ],
              [
                t("records.profile.fields.sex"),
                resident.sex ? sexLabel(resident.sex, t) : dash,
              ],
              [
                t("records.profile.fields.civilStatus"),
                resident.civil_status
                  ? civilStatusLabel(resident.civil_status, t)
                  : dash,
              ],
            ],
          },
          {
            title: t("records.form.sections.address"),
            rows: [
              [
                t("records.profile.fields.address"),
                residentAddress(resident, streets) || dash,
              ],
              [
                t("records.profile.fields.residentSince"),
                resident.resident_since_birth
                  ? t("records.profile.fields.sinceBirth")
                  : resident.resident_since_year
                    ? String(resident.resident_since_year)
                    : dash,
              ],
              [
                t("records.profile.fields.residentType"),
                resident.resident_type
                  ? residentTypeLabel(resident.resident_type, t)
                  : dash,
              ],
              [
                t("records.profile.fields.voter"),
                voterLabel(resident.voter_registration),
              ],
            ],
          },
          ...(resident.emergency_contact_name ||
          resident.emergency_contact_address ||
          resident.emergency_contact_phone
            ? [
                {
                  title: t("records.form.emergency.legend"),
                  rows: [
                    [
                      t("records.profile.fields.emergency"),
                      resident.emergency_contact_name || dash,
                    ],
                    [
                      t("records.profile.fields.emergencyAddress"),
                      resident.emergency_contact_address || dash,
                    ],
                    [
                      t("records.profile.fields.emergencyPhone"),
                      resident.emergency_contact_phone || dash,
                    ],
                  ] as [string, string][],
                },
              ]
            : []),
          ...(archived && resident.archive_reason
            ? [
                {
                  title: t("records.profile.fields.recordStatus"),
                  rows: [
                    [
                      t("records.profile.fields.archiveReason"),
                      resident.archive_reason,
                    ],
                  ] as [string, string][],
                },
              ]
            : []),
        ]
      : []

  return (
    <Dialog open={Boolean(resident)} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalShell} ${modalTall} sm:max-w-4xl`}>
        <DialogHeader className={modalHeader}>
          <DialogTitle className="text-xl">
            {t("records.profile.title")}
          </DialogTitle>
          <DialogDescription className="max-sm:sr-only">
            {t("records.profile.description")}
          </DialogDescription>
        </DialogHeader>
        {resident ? (
          <>
            <div className="flex shrink-0 flex-col gap-3 border-b px-5 py-3 sm:gap-4 sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-nowrap sm:gap-4 sm:p-5">
              {resident.has_photo && photoQuery.data ? (
                <img
                  src={photoQuery.data}
                  alt={t("records.profile.photoCard.alt", {
                    name: resident.full_name,
                  })}
                  className="h-20 w-16 shrink-0 rounded-lg border bg-white object-cover sm:h-28 sm:w-24"
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <UserRound className="size-7" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold sm:text-xl">{resident.full_name}</p>
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
              className="flex shrink-0 gap-1.5 overflow-x-auto rounded-lg bg-muted/50 p-1"
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
                  className="min-h-11 shrink-0 rounded-md px-4 sm:min-h-10"
                >
                  {t(tab.labelKey)}
                </Button>
              ))}
            </div>

            </div>
            <div className={`${modalBody} flex flex-col gap-4`}>
            {profileTab === "Details" ? (
              <>
                {resident?.has_photo && !photoQuery.data ? (
                  <p className="text-sm text-muted-foreground">
                    {photoQuery.isLoading
                      ? t("records.profile.photoCard.loading")
                      : t("records.profile.photoCard.unavailable")}
                  </p>
                ) : null}
                <div className="mx-auto w-full max-w-3xl space-y-6">
                  {detailSections.map((section) => (
                    <section key={section.title}>
                      <h3 className="border-b pb-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
                        {section.title}
                      </h3>
                      <dl className="divide-y divide-border/60">
                        {section.rows.map(([label, value]) => (
                          <div
                            key={label}
                            className="grid gap-0.5 py-2.5 text-sm sm:grid-cols-[13rem_1fr] sm:gap-4"
                          >
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="min-w-0 break-words font-medium">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              </>
            ) : null}

            {profileTab === "Family & Sector" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                              {documentTypeLabel(
                                item.document_type_code,
                                documentName.get(item.document_type_id) ??
                                  item.document_type_code,
                                t,
                              )}
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

            </div>
            {onEdit && !archived && profileTab === "Details" ? (
              <div className="flex shrink-0 justify-end border-t bg-muted/30 px-5 py-3 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  onClick={onEdit}
                >
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
