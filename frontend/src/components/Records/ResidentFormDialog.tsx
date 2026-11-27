import { UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type LookupItem,
  type ResidentCreate,
  type ResidentPublic,
  ResidentsService,
} from "@/client"
import { FieldError } from "@/components/Common/FieldError"
import { formControlClass } from "@/components/Common/formStyles"
import {
  ModalSection,
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
  modalTall,
} from "@/components/Common/ModalLayout"
import { Select } from "@/components/Common/Select"
import { uploadResidentPhoto } from "@/components/Issuances/NewIssuance/issuanceApi"
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
import {
  isValidPhone,
  isValidPurok,
  isValidYear,
  ruleProps,
} from "@/lib/inputRules"
import {
  clearResidentDraft,
  readResidentDraft,
  writeResidentDraft,
} from "@/lib/residentDraft"
import { civilStatusLabel } from "@/lib/residentLabels"
import {
  civilStatuses,
  readApiError,
  residencyTypes,
  suffixes,
} from "@/lib/residents"

type FormState = {
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  birthdate: string
  birth_place: string
  sex: string
  civil_status: string
  occupation: string
  house_number: string
  street_id: string
  purok: string
  resident_since_year: string
  resident_since_birth: boolean
  resident_type: string
  voter_registration: string
  residency_type: string
  proof_verified: boolean
  proof_date: string
  emergency_contact_name: string
  emergency_contact_address: string
  emergency_contact_phone: string
  sector_ids: number[]
}

function emptyForm(): FormState {
  return {
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    birthdate: "",
    birth_place: "",
    sex: "",
    civil_status: "",
    occupation: "",
    house_number: "",
    street_id: "",
    purok: "",
    resident_since_year: "",
    resident_since_birth: false,
    resident_type: "",
    voter_registration: "",
    residency_type: "",
    proof_verified: false,
    proof_date: "",
    emergency_contact_name: "",
    emergency_contact_address: "",
    emergency_contact_phone: "",
    sector_ids: [],
  }
}

function formFromResident(resident: ResidentPublic): FormState {
  return {
    first_name: resident.first_name,
    middle_name: resident.middle_name ?? "",
    last_name: resident.last_name,
    suffix: resident.suffix ?? "",
    birthdate: resident.birthdate ?? "",
    birth_place: resident.birth_place ?? "",
    sex: resident.sex ?? "",
    civil_status: resident.civil_status ?? "",
    occupation: resident.occupation ?? "",
    house_number: resident.house_number ?? "",
    street_id: resident.street_id ? String(resident.street_id) : "",
    purok: resident.purok ? String(resident.purok) : "",
    resident_since_year: resident.resident_since_year
      ? String(resident.resident_since_year)
      : "",
    resident_since_birth: Boolean(resident.resident_since_birth),
    resident_type: resident.resident_type ?? "",
    voter_registration: resident.voter_registration ?? "",
    residency_type: resident.residency_type ?? "",
    proof_verified: Boolean(resident.voter_proof_verified_at),
    proof_date: resident.voter_proof_verified_at ?? "",
    emergency_contact_name: resident.emergency_contact_name ?? "",
    emergency_contact_address: resident.emergency_contact_address ?? "",
    emergency_contact_phone: resident.emergency_contact_phone ?? "",
    sector_ids: resident.sector_ids,
  }
}

const text = (value: string) => value.trim() || null
const whole = (value: string) => (value.trim() ? Number(value) : null)

/** The payload shared by create and update; blank inputs are sent as null. */
function buildBody(form: FormState): ResidentCreate {
  return {
    first_name: form.first_name.trim(),
    middle_name: text(form.middle_name),
    last_name: form.last_name.trim(),
    suffix: (form.suffix || null) as ResidentCreate["suffix"],
    birthdate: form.birthdate || null,
    birth_place: text(form.birth_place),
    sex: (form.sex || null) as ResidentCreate["sex"],
    civil_status: (form.civil_status || null) as ResidentCreate["civil_status"],
    occupation: text(form.occupation),
    house_number: text(form.house_number),
    street_id: whole(form.street_id),
    purok: whole(form.purok),
    resident_since_year: form.resident_since_birth
      ? null
      : whole(form.resident_since_year),
    resident_since_birth: form.resident_since_birth,
    resident_type: text(form.resident_type),
    voter_registration: (form.voter_registration ||
      null) as ResidentCreate["voter_registration"],
    residency_type: (form.residency_type ||
      null) as ResidentCreate["residency_type"],
    emergency_contact_name: text(form.emergency_contact_name),
    emergency_contact_address: text(form.emergency_contact_address),
    emergency_contact_phone: text(form.emergency_contact_phone),
    sector_ids: form.sector_ids,
  }
}

type ResidentFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The resident being edited, or null to add a new one. */
  resident: ResidentPublic | null
  streets: LookupItem[]
  sectors: LookupItem[]
  onSaved: (
    resident: ResidentPublic,
    mode: "created" | "updated" | "unchanged",
    photoError?: string,
    proofError?: string,
  ) => void
}

const labelClass = "flex flex-col gap-2 text-sm font-medium"

/** The red asterisk of a required field; the input itself says "required". */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {" "}
      *
    </span>
  )
}

/** Today in Manila as YYYY-MM-DD, the latest birthdate the server accepts. */
function todayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
}

type DuplicateMatch = {
  id: string
  full_name: string
  birthdate: string | null
  status: string
}

/** The matches the server names in a possible-duplicate answer (may be absent). */
function readDuplicateMatches(detail: unknown): DuplicateMatch[] {
  const list = (detail as { matches?: unknown } | undefined)?.matches
  if (!Array.isArray(list)) return []
  return list.filter(
    (item): item is DuplicateMatch =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as DuplicateMatch).id === "string" &&
      typeof (item as DuplicateMatch).full_name === "string",
  )
}

export function ResidentFormDialog({
  open,
  onOpenChange,
  resident,
  streets,
  sectors,
  onSaved,
}: ResidentFormDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const userId = user?.id
  const [draftBack, setDraftBack] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [duplicate, setDuplicate] = useState(false)
  // Who the server says is already on record (name and birthdate only).
  const [matches, setMatches] = useState<DuplicateMatch[]>([])
  // A second click or Enter before the first save answers must not add a
  // second record; state alone is too slow because it updates after a render.
  const submitting = useRef(false)
  // Set by the first Save click; the missing-field messages show from then on.
  const [submitted, setSubmitted] = useState(false)
  const [photoDataUrl, setPhotoDataUrl] = useState("")

  useEffect(() => {
    if (!open) return
    const draft =
      !resident && userId ? readResidentDraft(userId, emptyForm()) : null
    setDraftBack(Boolean(draft))
    setForm(
      resident ? formFromResident(resident) : (draft?.form ?? emptyForm()),
    )
    setError("")
    setDuplicate(false)
    setMatches([])
    setSubmitted(false)
    setPhotoDataUrl("")
  }, [open, resident, userId])

  // A new resident being typed is kept as a draft; an empty form leaves none.
  useEffect(() => {
    if (!open || resident || !userId) return
    if (JSON.stringify(form) === JSON.stringify(emptyForm())) {
      clearResidentDraft(userId)
    } else writeResidentDraft(userId, form)
  }, [form, open, resident, userId])

  function discardDraft() {
    if (userId) clearResidentDraft(userId)
    setForm(emptyForm())
    setDraftBack(false)
    setSubmitted(false)
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setDuplicate(false)
    setMatches([])
  }

  async function submit(confirmDuplicate: boolean) {
    if (submitting.current) return
    if (
      (form.emergency_contact_phone &&
        !isValidPhone(form.emergency_contact_phone)) ||
      !isValidPurok(form.purok) ||
      (!form.resident_since_birth && !isValidYear(form.resident_since_year))
    ) {
      setSubmitted(true)
      setError(t("records.form.errors.checkFields"))
      return
    }
    submitting.current = true
    setSaving(true)
    setError("")
    try {
      const body = buildBody(form)
      let saved: ResidentPublic = resident
        ? (
            await ResidentsService.updateResident({
              path: { resident_id: resident.id },
              body,
              query: confirmDuplicate ? { confirm_duplicate: true } : undefined,
            })
          ).data
        : (
            await ResidentsService.createResident({
              body,
              query: confirmDuplicate ? { confirm_duplicate: true } : undefined,
            })
          ).data
      // Proof of voter registration has its own endpoints (and audit rows); it
      // only applies to a new or renting resident.
      let proofError = ""
      const wasVerified = resident?.voter_proof_verified_at ?? ""
      const wantsProof =
        (form.residency_type === "new" || form.residency_type === "renting") &&
        form.proof_verified
      const proofDate = form.proof_date || todayManila()
      const proofChanged = wantsProof
        ? proofDate !== wasVerified
        : Boolean(wasVerified) &&
          (form.residency_type === "new" || form.residency_type === "renting")
      if (proofChanged) {
        try {
          if (wasVerified) {
            saved = (
              await ResidentsService.clearVoterProof({
                path: { resident_id: saved.id },
              })
            ).data
          }
          if (wantsProof) {
            saved = (
              await ResidentsService.verifyVoterProof({
                path: { resident_id: saved.id },
                body: { verified_on: proofDate },
              })
            ).data
          }
        } catch (caughtProof) {
          proofError = readApiError(caughtProof).message
        }
      }
      let photoError = ""
      if (photoDataUrl) {
        try {
          await uploadResidentPhoto(saved.id, photoDataUrl)
          saved = (
            await ResidentsService.readResident({
              path: { resident_id: saved.id },
            })
          ).data
        } catch (caughtPhoto) {
          photoError = readApiError(caughtPhoto).message
        }
      }
      // The server leaves the record (and the Activity Log) alone when nothing
      // changed, so an unchanged timestamp and no new photo means "no changes".
      const unchanged =
        resident !== null &&
        !photoDataUrl &&
        saved.updated_at === resident.updated_at
      if (!resident && userId) clearResidentDraft(userId)
      onSaved(
        saved,
        resident ? (unchanged ? "unchanged" : "updated") : "created",
        photoError || undefined,
        proofError || undefined,
      )
    } catch (caught) {
      const failure = readApiError(caught)
      if (failure.code === "possible_duplicate") {
        setDuplicate(true)
        setMatches(readDuplicateMatches(failure.detail))
      } else setError(failure.message)
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  const firstMissing = !form.first_name.trim()
  const lastMissing = !form.last_name.trim()
  const showFirstError = submitted && firstMissing
  const showLastError = submitted && lastMissing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalShell} ${modalTall} sm:max-w-4xl`}>
        <DialogHeader className={modalHeader}>
          <DialogTitle className="text-xl">
            {resident
              ? t("records.form.editTitle")
              : t("records.form.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("records.form.description")}</DialogDescription>
        </DialogHeader>

        {draftBack && !resident ? (
          <div
            data-testid="resident-draft-notice"
            className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-5 py-2 text-sm sm:px-6"
          >
            <span>{t("records.form.draft.restored")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="resident-draft-discard"
              onClick={discardDraft}
            >
              {t("records.form.draft.discard")}
            </Button>
          </div>
        ) : null}

        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (saving) return
            setSubmitted(true)
            if (firstMissing || lastMissing) {
              // Take the person to the first field that needs an answer.
              document
                .getElementById(
                  firstMissing
                    ? "resident-form-first-name"
                    : "resident-form-last-name",
                )
                ?.focus()
              return
            }
            void submit(false)
          }}
        >
          <div className={`${modalBody} grid auto-rows-min gap-7`}>
            <p className="-mb-3 text-xs text-muted-foreground">
              {t("records.form.requiredNote")}
            </p>
            <ModalSection title={t("records.form.sections.personal")}>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_7.5rem]">
                <label
                  htmlFor="resident-form-first-name"
                  className={labelClass}
                >
                  <span>
                    {t("records.form.firstName")}
                    <RequiredMark />
                  </span>
                  <input
                    id="resident-form-first-name"
                    value={form.first_name}
                    {...ruleProps("name", (next) => set("first_name", next))}
                    className={formControlClass}
                    required
                    aria-invalid={showFirstError || undefined}
                    aria-describedby={
                      showFirstError
                        ? "resident-form-first-name-error"
                        : undefined
                    }
                  />
                  <FieldError id="resident-form-first-name-error">
                    {showFirstError ? t("records.form.errors.firstName") : null}
                  </FieldError>
                </label>
                <label className={labelClass}>
                  {t("records.form.middleName")}
                  <input
                    value={form.middle_name}
                    {...ruleProps("name", (next) => set("middle_name", next))}
                    className={formControlClass}
                  />
                </label>
                <label htmlFor="resident-form-last-name" className={labelClass}>
                  <span>
                    {t("records.form.lastName")}
                    <RequiredMark />
                  </span>
                  <input
                    id="resident-form-last-name"
                    value={form.last_name}
                    {...ruleProps("name", (next) => set("last_name", next))}
                    className={formControlClass}
                    required
                    aria-invalid={showLastError || undefined}
                    aria-describedby={
                      showLastError
                        ? "resident-form-last-name-error"
                        : undefined
                    }
                  />
                  <FieldError id="resident-form-last-name-error">
                    {showLastError ? t("records.form.errors.lastName") : null}
                  </FieldError>
                </label>
                <label htmlFor="resident-form-suffix" className={labelClass}>
                  {t("records.form.suffix")}
                  <Select
                    id="resident-form-suffix"
                    value={form.suffix}
                    onChange={(event) => set("suffix", event.target.value)}
                    className={formControlClass}
                  >
                    <option value="">{t("records.form.suffixNone")}</option>
                    {suffixes.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </Select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
                <label className={labelClass}>
                  {t("records.form.birthdate")}
                  <input
                    type="date"
                    max={todayManila()}
                    value={form.birthdate}
                    onChange={(event) => set("birthdate", event.target.value)}
                    className={formControlClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("records.form.birthPlace")}
                  <input
                    value={form.birth_place}
                    onChange={(event) => set("birth_place", event.target.value)}
                    className={formControlClass}
                  />
                </label>
                <label htmlFor="resident-form-sex" className={labelClass}>
                  {t("records.form.sex")}
                  <Select
                    id="resident-form-sex"
                    value={form.sex}
                    onChange={(event) => set("sex", event.target.value)}
                    className={formControlClass}
                  >
                    <option value="">{t("records.form.notSet")}</option>
                    <option value="Male">{t("records.labels.sex.Male")}</option>
                    <option value="Female">
                      {t("records.labels.sex.Female")}
                    </option>
                  </Select>
                </label>
                <label
                  htmlFor="resident-form-civil-status"
                  className={labelClass}
                >
                  {t("records.form.civilStatus")}
                  <Select
                    id="resident-form-civil-status"
                    value={form.civil_status}
                    onChange={(event) =>
                      set("civil_status", event.target.value)
                    }
                    className={formControlClass}
                  >
                    <option value="">{t("records.form.notSet")}</option>
                    {civilStatuses.map((item) => (
                      <option key={item} value={item}>
                        {civilStatusLabel(item, t)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className={labelClass}>
                  {t("records.form.occupation")}
                  <input
                    value={form.occupation}
                    maxLength={100}
                    onChange={(event) => set("occupation", event.target.value)}
                    className={formControlClass}
                  />
                </label>
              </div>
            </ModalSection>

            <ModalSection title={t("records.form.photo.label")}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-32 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30">
                  {photoDataUrl ? (
                    <img
                      src={photoDataUrl}
                      alt={t("records.form.photo.previewAlt")}
                      className="size-full bg-white object-cover"
                    />
                  ) : (
                    <UserRound
                      className="size-9 text-muted-foreground/60"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
                  <label htmlFor="resident-photo" className="sr-only">
                    {t("records.form.photo.label")}
                  </label>
                  <p className="text-xs font-normal text-muted-foreground">
                    {resident?.has_photo
                      ? t("records.form.photo.onFile")
                      : t("records.form.photo.optional")}
                  </p>
                  <input
                    id="resident-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      setPhotoDataUrl("")
                      setError("")
                      if (file.size > 10 * 1024 * 1024) {
                        setError(t("records.form.photo.tooLarge"))
                        event.target.value = ""
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = () =>
                        setPhotoDataUrl(String(reader.result ?? ""))
                      reader.onerror = () =>
                        setError(t("records.form.photo.unreadable"))
                      reader.readAsDataURL(file)
                    }}
                  />
                </div>
              </div>
            </ModalSection>

            <ModalSection title={t("records.form.sections.address")}>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
                <label className={labelClass}>
                  {t("records.form.houseNumber")}
                  <input
                    value={form.house_number}
                    onChange={(event) =>
                      set("house_number", event.target.value)
                    }
                    className={formControlClass}
                  />
                </label>
                <label htmlFor="resident-form-street" className={labelClass}>
                  {t("records.form.street")}
                  <Select
                    id="resident-form-street"
                    value={form.street_id}
                    onChange={(event) => set("street_id", event.target.value)}
                    className={formControlClass}
                  >
                    <option value="">
                      {streets.length === 0
                        ? t("records.form.noStreets")
                        : t("records.form.notSet")}
                    </option>
                    {streets.map((street) => (
                      <option key={street.id} value={street.id}>
                        {street.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className={labelClass}>
                  {t("records.form.purok")}
                  <input
                    value={form.purok}
                    {...ruleProps("digits", (next) => set("purok", next), 2)}
                    aria-invalid={!isValidPurok(form.purok) || undefined}
                    className={formControlClass}
                  />
                  <FieldError>
                    {isValidPurok(form.purok)
                      ? null
                      : t("records.form.errors.purok")}
                  </FieldError>
                </label>
              </div>
              <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <label className={labelClass}>
                  {t("records.form.residentSince")}
                  <input
                    value={
                      form.resident_since_birth ? "" : form.resident_since_year
                    }
                    disabled={form.resident_since_birth}
                    {...ruleProps("year", (next) =>
                      set("resident_since_year", next),
                    )}
                    aria-invalid={
                      !form.resident_since_birth &&
                      form.resident_since_year.length === 4 &&
                      !isValidYear(form.resident_since_year)
                        ? true
                        : undefined
                    }
                    className={formControlClass}
                  />
                  <FieldError>
                    {form.resident_since_birth ||
                    form.resident_since_year.length < 4 ||
                    isValidYear(form.resident_since_year)
                      ? null
                      : t("records.form.errors.year", {
                          year: new Date().getFullYear(),
                        })}
                  </FieldError>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={form.resident_since_birth}
                    onChange={(event) =>
                      set("resident_since_birth", event.target.checked)
                    }
                  />
                  {t("records.form.sinceBirth")}
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label htmlFor="resident-form-residency" className={labelClass}>
                  {t("records.form.residencyType")}
                  <Select
                    id="resident-form-residency"
                    value={form.residency_type}
                    onChange={(event) =>
                      set("residency_type", event.target.value)
                    }
                    className={formControlClass}
                  >
                    <option value="">{t("records.form.notSet")}</option>
                    {residencyTypes.map((item) => (
                      <option key={item} value={item}>
                        {t(`records.residency.${item}`)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label htmlFor="resident-form-voter" className={labelClass}>
                  {t("records.form.voter")}
                  <Select
                    id="resident-form-voter"
                    value={form.voter_registration}
                    onChange={(event) =>
                      set("voter_registration", event.target.value)
                    }
                    className={formControlClass}
                  >
                    <option value="">{t("records.form.notSet")}</option>
                    <option value="registered">
                      {t("records.form.registered")}
                    </option>
                    <option value="unregistered">
                      {t("records.form.unregistered")}
                    </option>
                  </Select>
                </label>
              </div>
              {form.residency_type === "new" ||
              form.residency_type === "renting" ? (
                <div className="flex flex-col gap-2 text-sm font-medium">
                  <span className="flex min-h-11 items-center gap-2 font-normal sm:min-h-6">
                    <input
                      id="resident-form-proof"
                      type="checkbox"
                      checked={form.proof_verified}
                      onChange={(event) => {
                        set("proof_verified", event.target.checked)
                        if (event.target.checked && !form.proof_date)
                          set("proof_date", todayManila())
                      }}
                    />
                    <label htmlFor="resident-form-proof">
                      {t("records.form.proofVerified")}
                    </label>
                  </span>
                  {form.proof_verified ? (
                    <label
                      htmlFor="resident-form-proof-date"
                      className={`${labelClass} sm:max-w-xs`}
                    >
                      {t("records.form.proofDate")}
                      <input
                        id="resident-form-proof-date"
                        type="date"
                        max={todayManila()}
                        value={form.proof_date}
                        onChange={(event) =>
                          set("proof_date", event.target.value)
                        }
                        className={formControlClass}
                      />
                    </label>
                  ) : null}
                  {resident?.voter_proof_verified_by_name &&
                  form.proof_verified &&
                  form.proof_date === resident.voter_proof_verified_at ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      {t("records.form.proofRecordedBy", {
                        name: resident.voter_proof_verified_by_name,
                      })}
                    </span>
                  ) : null}
                  <span className="text-xs font-normal text-muted-foreground">
                    {form.proof_verified
                      ? t("records.form.proofHelpVerified")
                      : t("records.form.proofHelpUnverified")}
                  </span>
                </div>
              ) : null}
            </ModalSection>

            <ModalSection
              title={t("records.form.emergency.legend")}
              className="sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]"
            >
              <label className={labelClass}>
                {t("records.form.emergency.name")}
                <input
                  value={form.emergency_contact_name}
                  {...ruleProps("name", (next) =>
                    set("emergency_contact_name", next),
                  )}
                  className={formControlClass}
                />
              </label>
              <label className={labelClass}>
                {t("records.form.emergency.address")}
                <input
                  value={form.emergency_contact_address}
                  onChange={(event) =>
                    set("emergency_contact_address", event.target.value)
                  }
                  className={formControlClass}
                />
              </label>
              <label className={labelClass}>
                {t("records.form.emergency.phone")}
                <input
                  value={form.emergency_contact_phone}
                  {...ruleProps("phone", (next) =>
                    set("emergency_contact_phone", next),
                  )}
                  placeholder="09XX XXX XXXX"
                  aria-invalid={
                    form.emergency_contact_phone &&
                    !isValidPhone(form.emergency_contact_phone)
                      ? true
                      : undefined
                  }
                  className={formControlClass}
                />
                <FieldError>
                  {form.emergency_contact_phone &&
                  !isValidPhone(form.emergency_contact_phone)
                    ? t("records.form.errors.phone")
                    : null}
                </FieldError>
              </label>
            </ModalSection>

            <ModalSection
              title={t("records.form.sectors")}
              className="sm:grid-cols-2 lg:grid-cols-3"
            >
              {sectors.map((sector) => (
                <label
                  key={sector.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-background px-3 text-sm transition-colors hover:border-ring/50 hover:bg-muted/40 has-[:checked]:border-brand/50 has-[:checked]:bg-brand/10"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={form.sector_ids.includes(sector.id)}
                    onChange={(event) =>
                      set(
                        "sector_ids",
                        event.target.checked
                          ? [...form.sector_ids, sector.id]
                          : form.sector_ids.filter((id) => id !== sector.id),
                      )
                    }
                  />
                  {sector.name}
                </label>
              ))}
            </ModalSection>

            {duplicate ? (
              <div
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                <p className="font-medium">
                  {t("records.form.duplicate.title")}
                </p>
                <p className="mt-1">
                  {t("records.form.duplicate.description")}
                </p>
                {matches.length > 0 ? (
                  <ul
                    className="mt-2 list-disc ps-5"
                    data-testid="duplicate-matches"
                  >
                    {matches.map((match) => (
                      <li key={match.id}>
                        {match.full_name}
                        {match.birthdate
                          ? `, ${t("records.form.duplicate.born", { date: match.birthdate })}`
                          : `, ${t("records.form.duplicate.noBirthdate")}`}
                        {match.status === "archived"
                          ? ` (${t("records.form.duplicate.archived")})`
                          : match.status === "deceased"
                            ? ` (${t("records.form.duplicate.deceased")})`
                            : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  disabled={saving}
                  onClick={() => void submit(true)}
                >
                  {t("records.form.duplicate.saveAnyway")}
                </Button>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className={modalFooter}>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={() => onOpenChange(false)}
            >
              {t("records.form.cancel")}
            </Button>
            <Button
              type="submit"
              className="min-h-11 sm:min-h-9"
              disabled={saving}
            >
              {saving
                ? t("records.form.saving")
                : resident
                  ? t("records.form.saveChanges")
                  : t("records.form.addSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
