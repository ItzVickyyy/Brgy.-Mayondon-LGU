import { UserRound } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type LookupItem,
  type ResidentCreate,
  type ResidentPublic,
  ResidentsService,
} from "@/client"
import { formControlClass } from "@/components/Common/formStyles"
import { Select } from "@/components/Common/Select"
import {
  ModalSection,
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
  modalTall,
} from "@/components/Common/ModalLayout"
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
import { civilStatusLabel, residentTypeLabel } from "@/lib/residentLabels"
import {
  civilStatuses,
  readApiError,
  residentTypes,
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
  house_number: string
  street_id: string
  purok: string
  resident_since_year: string
  resident_since_birth: boolean
  resident_type: string
  voter_registration: string
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
    house_number: "",
    street_id: "",
    purok: "",
    resident_since_year: "",
    resident_since_birth: false,
    resident_type: "",
    voter_registration: "",
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
    house_number: resident.house_number ?? "",
    street_id: resident.street_id ? String(resident.street_id) : "",
    purok: resident.purok ? String(resident.purok) : "",
    resident_since_year: resident.resident_since_year
      ? String(resident.resident_since_year)
      : "",
    resident_since_birth: Boolean(resident.resident_since_birth),
    resident_type: resident.resident_type ?? "",
    voter_registration: resident.voter_registration ?? "",
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
    mode: "created" | "updated",
    photoError?: string,
  ) => void
}

const labelClass = "flex flex-col gap-2 text-sm font-medium"

export function ResidentFormDialog({
  open,
  onOpenChange,
  resident,
  streets,
  sectors,
  onSaved,
}: ResidentFormDialogProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [duplicate, setDuplicate] = useState(false)
  const [photoDataUrl, setPhotoDataUrl] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(resident ? formFromResident(resident) : emptyForm())
    setError("")
    setDuplicate(false)
    setPhotoDataUrl("")
  }, [open, resident])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setDuplicate(false)
  }

  async function submit(confirmDuplicate: boolean) {
    setSaving(true)
    setError("")
    try {
      const body = buildBody(form)
      let saved: ResidentPublic = resident
        ? (
            await ResidentsService.updateResident({
              path: { resident_id: resident.id },
              body,
            })
          ).data
        : (
            await ResidentsService.createResident({
              body,
              query: confirmDuplicate ? { confirm_duplicate: true } : undefined,
            })
          ).data
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
      onSaved(saved, resident ? "updated" : "created", photoError || undefined)
    } catch (caught) {
      const failure = readApiError(caught)
      if (failure.code === "possible_duplicate") setDuplicate(true)
      else setError(failure.message)
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.first_name.trim() && form.last_name.trim() && !saving

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

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSave) void submit(false)
          }}
        >
          <div className={`${modalBody} grid gap-7`}>
            <ModalSection
              title={t("records.form.sections.personal")}
              className="sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className={labelClass}>
                {t("records.form.firstName")}
                <input
                  value={form.first_name}
                  onChange={(event) => set("first_name", event.target.value)}
                  className={formControlClass}
                  required
                />
              </label>
              <label className={labelClass}>
                {t("records.form.middleName")}
                <input
                  value={form.middle_name}
                  onChange={(event) => set("middle_name", event.target.value)}
                  className={formControlClass}
                />
              </label>
              <label className={labelClass}>
                {t("records.form.lastName")}
                <input
                  value={form.last_name}
                  onChange={(event) => set("last_name", event.target.value)}
                  className={formControlClass}
                  required
                />
              </label>
              <label htmlFor="resident-form-suffix" className={labelClass}>
                {t("records.form.suffix")}
                <Select id="resident-form-suffix"
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
              <label className={labelClass}>
                {t("records.form.birthdate")}
                <input
                  type="date"
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
                <Select id="resident-form-sex"
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
              <label htmlFor="resident-form-civil-status" className={labelClass}>
                {t("records.form.civilStatus")}
                <Select id="resident-form-civil-status"
                  value={form.civil_status}
                  onChange={(event) => set("civil_status", event.target.value)}
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

            <ModalSection
              title={t("records.form.sections.address")}
              className="sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className={labelClass}>
                {t("records.form.houseNumber")}
                <input
                  value={form.house_number}
                  onChange={(event) => set("house_number", event.target.value)}
                  className={formControlClass}
                />
              </label>
              <label htmlFor="resident-form-street" className={labelClass}>
                {t("records.form.street")}
                <Select id="resident-form-street"
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
                  type="number"
                  min={1}
                  value={form.purok}
                  onChange={(event) => set("purok", event.target.value)}
                  className={formControlClass}
                />
              </label>
              <label className={labelClass}>
                {t("records.form.residentSince")}
                <input
                  type="number"
                  min={1900}
                  value={form.resident_since_birth ? "" : form.resident_since_year}
                  disabled={form.resident_since_birth}
                  onChange={(event) =>
                    set("resident_since_year", event.target.value)
                  }
                  className={formControlClass}
                />
                <span className="flex min-h-6 items-center gap-2 font-normal">
                  <input
                    type="checkbox"
                    checked={form.resident_since_birth}
                    onChange={(event) =>
                      set("resident_since_birth", event.target.checked)
                    }
                  />
                  {t("records.form.sinceBirth")}
                </span>
              </label>
              <label htmlFor="resident-form-type" className={labelClass}>
                {t("records.form.residentType")}
                <Select id="resident-form-type"
                  value={form.resident_type}
                  onChange={(event) => set("resident_type", event.target.value)}
                  className={formControlClass}
                >
                  <option value="">{t("records.form.notSet")}</option>
                  {residentTypes.map((item) => (
                    <option key={item} value={item}>
                      {residentTypeLabel(item, t)}
                    </option>
                  ))}
                </Select>
              </label>
              <label htmlFor="resident-form-voter" className={labelClass}>
                {t("records.form.voter")}
                <Select id="resident-form-voter"
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
            </ModalSection>

            <ModalSection
              title={t("records.form.emergency.legend")}
              className="sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className={labelClass}>
                {t("records.form.emergency.name")}
                <input
                  value={form.emergency_contact_name}
                  onChange={(event) =>
                    set("emergency_contact_name", event.target.value)
                  }
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
                  onChange={(event) =>
                    set("emergency_contact_phone", event.target.value)
                  }
                  className={formControlClass}
                />
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
                <p className="mt-1">{t("records.form.duplicate.description")}</p>
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
              disabled={!canSave}
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
