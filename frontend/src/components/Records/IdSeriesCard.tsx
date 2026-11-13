import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Hash } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { BarangayIdsService, type IdSeriesPublic } from "@/client"
import { formControlClass } from "@/components/Common/formStyles"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { readApiError } from "@/lib/residents"

type Draft = {
  prefix: string
  includeYear: boolean
  digitWidth: string
  restartYearly: boolean
  nextNumber: string
  enabled: boolean
}

function toDraft(series: IdSeriesPublic): Draft {
  return {
    prefix: series.prefix,
    includeYear: series.include_year,
    digitWidth: String(series.digit_width),
    restartYearly: series.restart_yearly,
    nextNumber: String(series.next_number),
    enabled: series.enabled,
  }
}

/** Same layout the server uses: prefix, optional year, then the running number. */
function sample(draft: Draft) {
  const next = Number.parseInt(draft.nextNumber, 10)
  const width = Number.parseInt(draft.digitWidth, 10)
  if (!Number.isFinite(next) || next < 1) return ""
  const digits = width > 0 ? String(next).padStart(width, "0") : String(next)
  const year = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  })
  const middle = draft.includeYear ? `${year.slice(0, 4)}-` : ""
  return `${draft.prefix.trim()}${middle}${digits}`
}

/** Administrator setup of the Barangay ID numbering series (Barangay IDs tab). */
export function IdSeriesCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const seriesQuery = useQuery({
    queryKey: ["id-series"],
    queryFn: async () => (await BarangayIdsService.idsGetSeries()).data,
  })
  const series = seriesQuery.data

  // Start from what is saved each time the pop-up opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when it opens.
  useEffect(() => {
    if (open && series) {
      setDraft(toDraft(series))
      setError("")
      setSubmitted(false)
    }
  }, [open])

  const save = useMutation({
    mutationFn: async (value: Draft) =>
      (
        await BarangayIdsService.idsUpdateSeries({
          body: {
            prefix: value.prefix.trim(),
            include_year: value.includeYear,
            digit_width: Number.parseInt(value.digitWidth, 10),
            restart_yearly: value.restartYearly && value.includeYear,
            next_number: Number.parseInt(value.nextNumber, 10),
            enabled: value.enabled,
          },
        })
      ).data,
    onSuccess: () => {
      setOpen(false)
      showSuccessToast(t("records.ids.series.saved"))
      void queryClient.invalidateQueries({ queryKey: ["id-series"] })
      void queryClient.invalidateQueries({ queryKey: ["id-series-status"] })
    },
    onError: (caught) => setError(readApiError(caught).message),
  })

  const widthValue = Number.parseInt(draft?.digitWidth ?? "", 10)
  const nextValue = Number.parseInt(draft?.nextNumber ?? "", 10)
  const widthBad = !(widthValue >= 0 && widthValue <= 12)
  const nextBad = !(nextValue >= 1)

  function update(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
      aria-label={t("records.ids.series.title")}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-brand">
          <Hash className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold tracking-tight">
              {t("records.ids.series.title")}
            </h2>
            {series ? (
              <Badge variant={series.enabled ? "default" : "secondary"}>
                {series.enabled
                  ? t("records.ids.series.on")
                  : t("records.ids.series.off")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {series?.enabled
              ? t("records.ids.series.nextIs", { number: series.preview })
              : t("records.ids.series.offDescription")}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:shrink-0"
        disabled={!series}
        onClick={() => setOpen(true)}
      >
        {series?.enabled
          ? t("records.ids.series.edit")
          : t("records.ids.series.setUp")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`${modalShell} sm:max-w-lg`}>
          <DialogHeader className={modalHeader}>
            <DialogTitle className="text-xl">
              {t("records.ids.series.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("records.ids.series.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                setSubmitted(true)
                setError("")
                if (widthBad || nextBad || save.isPending) return
                save.mutate(draft)
              }}
            >
              <div className={`${modalBody} grid gap-4`}>
                <label className="grid gap-1.5 text-sm font-medium">
                  {t("records.ids.series.prefix")}
                  <input
                    id="series-prefix"
                    value={draft.prefix}
                    maxLength={30}
                    onChange={(event) => update({ prefix: event.target.value })}
                    className={formControlClass}
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("records.ids.series.prefixHelp")}
                  </span>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  {t("records.ids.series.nextNumber")}
                  <input
                    id="series-next-number"
                    inputMode="numeric"
                    value={draft.nextNumber}
                    onChange={(event) =>
                      update({
                        nextNumber: event.target.value.replace(/\D/g, ""),
                      })
                    }
                    aria-invalid={submitted && nextBad}
                    className={formControlClass}
                  />
                  <span
                    className={`text-xs font-normal ${submitted && nextBad ? "text-destructive" : "text-muted-foreground"}`}
                    role={submitted && nextBad ? "alert" : undefined}
                  >
                    {submitted && nextBad
                      ? t("records.ids.series.nextNumberError")
                      : t("records.ids.series.nextNumberHelp")}
                  </span>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  {t("records.ids.series.digitWidth")}
                  <input
                    id="series-digit-width"
                    inputMode="numeric"
                    value={draft.digitWidth}
                    onChange={(event) =>
                      update({
                        digitWidth: event.target.value.replace(/\D/g, ""),
                      })
                    }
                    aria-invalid={submitted && widthBad}
                    className={formControlClass}
                  />
                  <span
                    className={`text-xs font-normal ${submitted && widthBad ? "text-destructive" : "text-muted-foreground"}`}
                    role={submitted && widthBad ? "alert" : undefined}
                  >
                    {submitted && widthBad
                      ? t("records.ids.series.digitWidthError")
                      : t("records.ids.series.digitWidthHelp")}
                  </span>
                </label>
                <label
                  htmlFor="series-include-year"
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <Checkbox
                    id="series-include-year"
                    checked={draft.includeYear}
                    onCheckedChange={(checked) =>
                      update({
                        includeYear: checked === true,
                        restartYearly:
                          checked === true ? draft.restartYearly : false,
                      })
                    }
                  />
                  {t("records.ids.series.includeYear")}
                </label>
                <label
                  htmlFor="series-restart-yearly"
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <Checkbox
                    id="series-restart-yearly"
                    checked={draft.restartYearly && draft.includeYear}
                    disabled={!draft.includeYear}
                    onCheckedChange={(checked) =>
                      update({ restartYearly: checked === true })
                    }
                  />
                  {t("records.ids.series.restartYearly")}
                </label>
                <label
                  htmlFor="series-enabled"
                  className="flex min-h-11 items-center gap-3 text-sm font-medium"
                >
                  <Checkbox
                    id="series-enabled"
                    checked={draft.enabled}
                    onCheckedChange={(checked) =>
                      update({ enabled: checked === true })
                    }
                  />
                  {t("records.ids.series.enable")}
                </label>
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  {t("records.ids.series.example")}{" "}
                  <span className="font-semibold text-brand">
                    {sample(draft) || "—"}
                  </span>
                </p>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DialogFooter className={`${modalFooter} sm:justify-end`}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setOpen(false)}
                >
                  {t("common.confirm.cancel")}
                </Button>
                <Button
                  type="submit"
                  className="h-11"
                  disabled={save.isPending}
                >
                  {t("records.ids.series.save")}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
