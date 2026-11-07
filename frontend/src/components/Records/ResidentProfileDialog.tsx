import { useQuery } from "@tanstack/react-query"
import { CreditCard, FileCheck2, UserRound, Users } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBusinessDate, residentAddress } from "@/lib/residents"
import { issuanceApi } from "@/components/Issuances/NewIssuance/issuanceApi"

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

const statusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1)

const voterLabel: Record<string, string> = {
  registered: "Registered",
  unregistered: "Unregistered",
}

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
    queryFn: async () => resident ? issuanceApi.loadResidentPhoto(resident.id) : undefined,
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
        ["Resident reference", resident.id],
        ["Full name", resident.full_name],
        [
          "Birthdate / age",
          resident.birthdate
            ? `${formatBusinessDate(resident.birthdate)}${resident.age !== null ? ` · ${resident.age} yrs` : ""}`
            : "—",
        ],
        ["Birth place", resident.birth_place || "—"],
        ["Sex", resident.sex || "—"],
        ["Civil status", resident.civil_status || "—"],
        ["Complete address", residentAddress(resident, streets) || "—"],
        [
          "Resident since",
          resident.resident_since_birth
            ? "Since birth"
            : resident.resident_since_year
              ? String(resident.resident_since_year)
              : "—",
        ],
        ["Resident type", resident.resident_type || "—"],
        [
          "Voter registration",
          voterLabel[resident.voter_registration ?? ""] ?? "—",
        ],
        ["Emergency contact", resident.emergency_contact_name || "—"],
        [
          "Emergency contact address",
          resident.emergency_contact_address || "—",
        ],
        ["Emergency contact phone", resident.emergency_contact_phone || "—"],
        ["Photo", resident.has_photo ? "On file" : "None"],
        ["Record status", statusLabel(resident.status)],
        ...(archived && resident.archive_reason
          ? ([["Archive reason", resident.archive_reason]] as [
              string,
              string,
            ][])
          : []),
      ]
    : []

  return (
    <Dialog open={Boolean(resident)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Resident Profile</DialogTitle>
          <DialogDescription>
            Review resident details, family and sector information, ID records,
            and issuance history.
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
                  {residentAddress(resident, streets) || "No address on record"}
                </p>
              </div>
              <Badge
                variant="outline"
                className={statusStyles[statusLabel(resident.status)]}
              >
                {statusLabel(resident.status)}
              </Badge>
            </div>
            <div
              className="flex flex-wrap gap-2 border-b pb-3"
              role="tablist"
              aria-label="Resident profile sections"
            >
              {[
                "Details",
                "Family & Sector",
                "Barangay ID",
                "Issuance History",
              ].map((tab) => (
                <Button
                  key={tab}
                  type="button"
                  role="tab"
                  variant={profileTab === tab ? "default" : "ghost"}
                  aria-selected={profileTab === tab}
                  onClick={() => onProfileTabChange(tab)}
                  className="min-h-11 rounded-md px-3"
                >
                  {tab}
                </Button>
              ))}
            </div>

            {profileTab === "Details" ? (
              <>
                {resident?.has_photo ? (
                  <div className="mb-3 flex items-center gap-4 rounded-xl border bg-card p-4">
                    {photoQuery.data ? <img src={photoQuery.data} alt={resident.full_name + " portrait"} className="h-24 w-20 rounded-md border bg-white object-cover" /> : <div className="flex h-24 w-20 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">{photoQuery.isLoading ? "Loading photo" : "Photo unavailable"}</div>}
                    <div><p className="font-semibold">Resident photo</p><p className="mt-1 text-sm text-muted-foreground">Used for Barangay ID and supported document printing.</p></div>
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
                  <h3 className="mt-2 font-semibold">Sectors</h3>
                  {sectorNames.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {sectorNames.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      No sector recorded.
                    </p>
                  )}
                </section>
                <section className="rounded-xl border bg-card p-4">
                  <Users className="size-5 text-brand" aria-hidden="true" />
                  <h3 className="mt-2 font-semibold">Family details</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Household and family member records are not available yet.
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
                    Barangay ID number
                  </p>
                  <p className="mt-1 font-semibold">
                    {resident.id_number || "None on record"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    ID numbers are set when an ID is issued from Issuance
                    Management.
                  </p>
                </section>
                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    Voter registration
                  </p>
                  <p className="mt-1 font-semibold">
                    {voterLabel[resident.voter_registration ?? ""] ?? "—"}
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
                  <h3 className="font-semibold">Issuance history</h3>
                </div>
                {historyQuery.isLoading ? (
                  <LoadingState title="Loading history..." />
                ) : historyQuery.isError ? (
                  <ErrorState
                    title="Could not load the history"
                    onRetry={() => historyQuery.refetch()}
                  />
                ) : historyQuery.data && historyQuery.data.data.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          {[
                            "Reference",
                            "Document",
                            "Issue date",
                            "Status",
                          ].map((label) => (
                            <th key={label} className="py-2 pr-4 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {historyQuery.data.data.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 pr-4 font-mono">
                              {item.reference_no ?? "Draft"}
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
                                {statusLabel(item.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="No documents yet"
                    description="Documents issued to this resident will appear here."
                  />
                )}
              </section>
            ) : null}

            {onEdit && !archived && profileTab === "Details" ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={onEdit}>
                  Edit details
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
