import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { type ResidentPublic, ResidentsService } from "@/client"
import { formControlClass } from "@/components/Common/formStyles"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Select } from "@/components/Common/Select"
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
  type DeathEvidence,
  type DeathPrecision,
  dateBoxValue,
  dateToSend,
  deathDateError,
  deathEvidences,
  deathPrecisions,
  todayManila,
} from "@/lib/deaths"
import { readApiError } from "@/lib/residents"

export type DeathDialogMode = "record" | "correct"

type RecordDeathDialogProps = {
  /** The resident the death is recorded for; null closes the pop-up. */
  resident: ResidentPublic | null
  mode: DeathDialogMode
  onOpenChange: (open: boolean) => void
  onSaved: (resident: ResidentPublic, mode: DeathDialogMode) => void
}

const labelClass = "flex flex-col gap-2 text-sm font-medium"
const MARKUP = /[<>\r\n]/

/**
 * Record a death, or correct the record in force (patch 328). The date may be
 * known only to the month or the year, or not at all; the evidence says whether
 * somebody reported it or staff saw a certificate or affidavit. No cause of death.
 */
export function RecordDeathDialog({
  resident,
  mode,
  onOpenChange,
  onSaved,
}: RecordDeathDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={resident !== null} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalShell} sm:max-w-lg`}>
        <DialogHeader className={modalHeader}>
          <DialogTitle className="text-xl">
            {mode === "record"
              ? t("records.death.recordTitle")
              : t("records.death.correctTitle")}
          </DialogTitle>
          <DialogDescription>
            {resident
              ? t(
                  mode === "record"
                    ? "records.death.recordDescription"
                    : "records.death.correctDescription",
                  { name: resident.full_name },
                )
              : ""}
          </DialogDescription>
        </DialogHeader>
        {resident ? (
          <DeathForm
            key={`${resident.id}-${mode}`}
            resident={resident}
            mode={mode}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DeathForm({
  resident,
  mode,
  onCancel,
  onSaved,
}: {
  resident: ResidentPublic
  mode: DeathDialogMode
  onCancel: () => void
  onSaved: (resident: ResidentPublic, mode: DeathDialogMode) => void
}) {
  const { t } = useTranslation()
  const current = mode === "correct" ? (resident.death ?? null) : null
  const [precision, setPrecision] = useState<DeathPrecision>(
    current?.date_precision ?? "day",
  )
  const [dateValue, setDateValue] = useState(
    current ? dateBoxValue(current.date_precision, current.date_of_death) : "",
  )
  const [evidence, setEvidence] = useState<DeathEvidence>(
    current?.evidence ?? "reported",
  )
  const [note, setNote] = useState(current?.source_note ?? "")
  const [reason, setReason] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)

  const dateError = deathDateError(precision, dateValue, resident.birthdate)
  const noteError = MARKUP.test(note) ? "noteChars" : null
  const reasonError =
    mode === "correct" && reason.trim().length < 3 ? "reasonShort" : null
  const sentDate = dateToSend(precision, dateValue)
  const unchanged =
    current !== null &&
    precision === current.date_precision &&
    sentDate === current.date_of_death &&
    evidence === current.evidence &&
    (note.trim() || null) === current.source_note
  // A date that is merely missing is not shown as an error before it is typed.
  const shownDateError =
    dateError && dateError !== "dateRequired" ? dateError : null
  const canSave = !dateError && !noteError && !reasonError && !unchanged

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        date_precision: precision,
        date_of_death: sentDate,
        evidence,
        source_note: note.trim() || null,
      }
      return (
        mode === "record"
          ? await ResidentsService.recordDeath({
              path: { resident_id: resident.id },
              body,
            })
          : await ResidentsService.correctDeath({
              path: { resident_id: resident.id },
              body: { ...body, reason: reason.trim() },
            })
      ).data
    },
    onSuccess: (saved) => onSaved(saved, mode),
    onError: (error) => setServerError(readApiError(error).message),
  })

  const maxBox =
    precision === "day"
      ? todayManila()
      : precision === "month"
        ? todayManila().slice(0, 7)
        : todayManila().slice(0, 4)

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSave || mutation.isPending) return
        setServerError(null)
        mutation.mutate()
      }}
    >
      <div className={`${modalBody} flex flex-col gap-4`}>
        <label htmlFor="death-precision" className={labelClass}>
          {t("records.death.fields.precision")}
          <Select
            id="death-precision"
            data-testid="death-precision"
            value={precision}
            onChange={(event) => {
              setPrecision(event.target.value as DeathPrecision)
              setDateValue("")
            }}
          >
            {deathPrecisions.map((item) => (
              <option key={item} value={item}>
                {t(`records.death.precision.${item}`)}
              </option>
            ))}
          </Select>
        </label>

        {precision === "unknown" ? (
          <p className="text-sm text-muted-foreground">
            {t("records.death.unknownHelp")}
          </p>
        ) : (
          <label htmlFor="death-date" className={labelClass}>
            {t(`records.death.fields.date.${precision}`)}
            {precision === "year" ? (
              <input
                id="death-date"
                data-testid="death-date"
                inputMode="numeric"
                maxLength={4}
                placeholder={t("records.death.yearExample")}
                value={dateValue}
                onChange={(event) =>
                  setDateValue(
                    event.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                aria-invalid={shownDateError ? true : undefined}
                aria-describedby={
                  shownDateError ? "death-date-error" : undefined
                }
                className={formControlClass}
              />
            ) : (
              <input
                id="death-date"
                data-testid="death-date"
                type={precision === "month" ? "month" : "date"}
                min={precision === "month" ? "1900-01" : "1900-01-01"}
                max={maxBox}
                value={dateValue}
                onChange={(event) => setDateValue(event.target.value)}
                aria-invalid={shownDateError ? true : undefined}
                aria-describedby={
                  shownDateError ? "death-date-error" : undefined
                }
                className={formControlClass}
              />
            )}
            {shownDateError ? (
              <span
                id="death-date-error"
                role="alert"
                className="text-xs font-normal text-destructive"
              >
                {t(`records.death.errors.${shownDateError}`)}
              </span>
            ) : null}
          </label>
        )}

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            {t("records.death.fields.evidence")}
          </legend>
          {deathEvidences.map((item) => (
            <label
              key={item}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-background px-3 py-2 text-sm has-[:checked]:border-ring has-[:checked]:bg-muted/40"
            >
              <input
                type="radio"
                name="death-evidence"
                value={item}
                data-testid={`death-evidence-${item}`}
                checked={evidence === item}
                onChange={() => setEvidence(item)}
                className="mt-1 size-4 accent-[var(--brand)]"
              />
              <span className="flex flex-col">
                <span className="font-medium">
                  {t(`records.death.evidence.${item}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`records.death.evidenceHelp.${item}`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <label htmlFor="death-note" className={labelClass}>
          {t("records.death.fields.note")}
          <input
            id="death-note"
            data-testid="death-note"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("records.death.notePlaceholder")}
            aria-invalid={noteError ? true : undefined}
            className={formControlClass}
          />
          <span className="text-xs font-normal text-muted-foreground">
            {noteError
              ? t("records.death.errors.noteChars")
              : t("records.death.noteHelp")}
          </span>
        </label>

        {mode === "correct" ? (
          <label htmlFor="death-reason" className={labelClass}>
            {t("records.death.fields.reason")}
            <textarea
              id="death-reason"
              data-testid="death-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("records.death.reasonPlaceholder")}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </label>
        ) : null}

        {serverError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {serverError}
          </p>
        ) : null}
      </div>
      <DialogFooter className={`${modalFooter} gap-2 sm:justify-end`}>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onCancel}
        >
          {t("common.confirm.cancel")}
        </Button>
        <Button
          type="submit"
          data-testid="death-submit"
          className="min-h-11"
          disabled={!canSave || mutation.isPending}
        >
          {mode === "record"
            ? t("records.death.recordConfirm")
            : t("records.death.correctConfirm")}
        </Button>
      </DialogFooter>
    </form>
  )
}
