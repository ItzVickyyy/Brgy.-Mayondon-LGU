import { useEffect, useState } from "react"

import {
  type LookupItem,
  type ResidentCreate,
  type ResidentPublic,
  ResidentsService,
} from "@/client"
import { uploadResidentPhoto } from "@/components/Issuances/NewIssuance/issuanceApi"
import { formControlClass } from "@/components/Common/formStyles"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  onSaved: (resident: ResidentPublic, mode: "created" | "updated", photoError?: string) => void
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
        ? (await ResidentsService.updateResident({ path: { resident_id: resident.id }, body })).data
        : (await ResidentsService.createResident({
            body,
            query: confirmDuplicate ? { confirm_duplicate: true } : undefined,
          })).data
      let photoError = ""
      if (photoDataUrl) {
        try {
          await uploadResidentPhoto(saved.id, photoDataUrl)
          saved = (await ResidentsService.readResident({ path: { resident_id: saved.id } })).data
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
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {resident ? "Edit resident details" : "Add resident"}
          </DialogTitle>
          <DialogDescription>
            Only the first and last name are required to save. Documents ask for
            more details, such as birthdate and address, when they are issued.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSave) void submit(false)
          }}
        >
          <label className={labelClass}>
            First name
            <input
              value={form.first_name}
              onChange={(event) => set("first_name", event.target.value)}
              className={formControlClass}
              required
            />
          </label>
          <label className={labelClass}>
            Middle name
            <input
              value={form.middle_name}
              onChange={(event) => set("middle_name", event.target.value)}
              className={formControlClass}
            />
          </label>
          <label className={labelClass}>
            Last name
            <input
              value={form.last_name}
              onChange={(event) => set("last_name", event.target.value)}
              className={formControlClass}
              required
            />
          </label>
          <label className={labelClass}>
            Suffix
            <select
              value={form.suffix}
              onChange={(event) => set("suffix", event.target.value)}
              className={formControlClass}
            >
              <option value="">None</option>
              {suffixes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Birthdate
            <input
              type="date"
              value={form.birthdate}
              onChange={(event) => set("birthdate", event.target.value)}
              className={formControlClass}
            />
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
            <label htmlFor="resident-photo">Resident photo</label>
            <p className="text-xs font-normal text-muted-foreground">
              {resident?.has_photo ? "A photo is already on file. Uploading a new image replaces it." : "Optional. Add a clear resident portrait for Barangay ID and document printing."}
            </p>
            <input
              id="resident-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (file.size > 10 * 1024 * 1024) {
                  setError("Choose an image smaller than 10 MB.")
                  event.target.value = ""
                  return
                }
                const reader = new FileReader()
                reader.onload = () => setPhotoDataUrl(String(reader.result ?? ""))
                reader.onerror = () => setError("The selected photo could not be read.")
                reader.readAsDataURL(file)
              }}
            />
            {photoDataUrl ? <img src={photoDataUrl} alt="Selected resident portrait preview" className="h-28 w-24 rounded-md border bg-white object-cover" /> : null}
          </div>

          <label className={labelClass}>
            Birth place
            <input
              value={form.birth_place}
              onChange={(event) => set("birth_place", event.target.value)}
              className={formControlClass}
            />
          </label>
          <label className={labelClass}>
            Sex
            <select
              value={form.sex}
              onChange={(event) => set("sex", event.target.value)}
              className={formControlClass}
            >
              <option value="">Not set</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </label>
          <label className={labelClass}>
            Civil status
            <select
              value={form.civil_status}
              onChange={(event) => set("civil_status", event.target.value)}
              className={formControlClass}
            >
              <option value="">Not set</option>
              {civilStatuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            House number
            <input
              value={form.house_number}
              onChange={(event) => set("house_number", event.target.value)}
              className={formControlClass}
            />
          </label>
          <label className={labelClass}>
            Street
            <select
              value={form.street_id}
              onChange={(event) => set("street_id", event.target.value)}
              className={formControlClass}
            >
              <option value="">
                {streets.length === 0 ? "No streets added yet" : "Not set"}
              </option>
              {streets.map((street) => (
                <option key={street.id} value={street.id}>
                  {street.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Purok
            <input
              type="number"
              min={1}
              value={form.purok}
              onChange={(event) => set("purok", event.target.value)}
              className={formControlClass}
            />
          </label>
          <label className={labelClass}>
            Resident since (year)
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
            <span className="flex items-center gap-2 font-normal">
              <input
                type="checkbox"
                checked={form.resident_since_birth}
                onChange={(event) =>
                  set("resident_since_birth", event.target.checked)
                }
              />
              Has lived here since birth
            </span>
          </label>
          <label className={labelClass}>
            Resident type
            <select
              value={form.resident_type}
              onChange={(event) => set("resident_type", event.target.value)}
              className={formControlClass}
            >
              <option value="">Not set</option>
              {residentTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Voter registration
            <select
              value={form.voter_registration}
              onChange={(event) =>
                set("voter_registration", event.target.value)
              }
              className={formControlClass}
            >
              <option value="">Not set</option>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
            </select>
          </label>

          <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium">
              Emergency contact
            </legend>
            <label className={labelClass}>
              Name
              <input
                value={form.emergency_contact_name}
                onChange={(event) =>
                  set("emergency_contact_name", event.target.value)
                }
                className={formControlClass}
              />
            </label>
            <label className={labelClass}>
              Address
              <input
                value={form.emergency_contact_address}
                onChange={(event) =>
                  set("emergency_contact_address", event.target.value)
                }
                className={formControlClass}
              />
            </label>
            <label className={labelClass}>
              Phone
              <input
                value={form.emergency_contact_phone}
                onChange={(event) =>
                  set("emergency_contact_phone", event.target.value)
                }
                className={formControlClass}
              />
            </label>
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Sectors</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {sectors.map((sector) => (
                <label
                  key={sector.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
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
            </div>
          </fieldset>

          {duplicate ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              <p className="font-medium">Possible duplicate</p>
              <p className="mt-1">
                A resident with the same name and birthdate is already on
                record. Check the list before saving a second copy.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={saving}
                onClick={() => void submit(true)}
              >
                Save anyway
              </Button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          ) : null}

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {saving
                ? "Saving..."
                : resident
                  ? "Save changes"
                  : "Add resident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
