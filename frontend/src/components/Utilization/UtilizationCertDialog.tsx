import { useQuery } from "@tanstack/react-query"
import { FileBadge, Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import { UtilizationService } from "@/client"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { formatLocaleNumber } from "@/lib/locale"
import {
  monthLabel,
  monthName,
  parseMonthKey,
  recentMonths,
} from "@/lib/utilizationCert"
import { REMARKS_MAX, SCALE, UtilizationSheet } from "./UtilizationSheet"

const IMAGE_WAIT_MS = 3000

/** The letterhead logo and the seal must be decoded before the print preview is drawn. */
function waitForSheetImages(): Promise<void> {
  const pending = Array.from(
    document.querySelectorAll<HTMLImageElement>(".cou-print-root img"),
  )
    .filter((image) => !image.complete)
    .map(
      (image) =>
        new Promise<void>((resolve) => {
          image.onload = image.onerror = () => resolve()
        }),
    )
  if (!pending.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, IMAGE_WAIT_MS)),
  ])
}

/**
 * Profile menu > Utilization Cert. The LSPU extension program asks the barangay for a Certificate of
 * Utilization every month. The page fills in the reporting period, the dates counted and the number
 * of clients served by itself; the rating, remarks, date of issue and signature stay blank for the
 * person who certifies it.
 * Popup text is English only, like the other information pop-ups.
 */
export function UtilizationCertDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { showErrorToast } = useCustomToast()
  const months = recentMonths()
  const [month, setMonth] = useState(months[0] ?? "")
  const [rating, setRating] = useState<number | null>(null)
  const [remarks, setRemarks] = useState("")
  const [printing, setPrinting] = useState(false)

  const figures = useQuery({
    queryKey: ["utilization", month],
    queryFn: async () =>
      (await UtilizationService.utilization({ query: { month } })).data,
    enabled: open && month !== "",
    // The count must be the real one at the moment of printing.
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (figures.isError) showErrorToast(t("utilization.loadFailed"))
  }, [figures.isError, showErrorToast, t])

  async function handlePrint() {
    if (!figures.data || printing) return
    try {
      // A certificate that leaves the screen is on record (Activity Log), month only.
      await UtilizationService.utilizationPrinted({ body: { month } })
    } catch {
      showErrorToast(t("utilization.printFailed"))
      return
    }
    setPrinting(true)
    try {
      await waitForSheetImages()
      // requestAnimationFrame never fires in a background tab, so a timer is the fallback.
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve(null))
        window.setTimeout(() => resolve(null), 250)
      })
      // index.css prints only the certificate while it is mounted; nothing is torn down afterwards.
      window.print()
    } finally {
      setPrinting(false)
    }
  }

  const data = figures.data
  const { month: monthNumber } = parseMonthKey(month)
  const clients = data ? formatLocaleNumber(data.clients_served) : "…"

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`${modalShell} sm:max-w-xl`}
          data-testid="utilization-dialog"
        >
          <DialogHeader className={modalHeader}>
            <div className="flex items-center gap-3 text-left">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
              >
                <FileBadge className="size-5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <DialogTitle className="text-lg leading-tight">
                  Certificate of Utilization
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Monthly certificate for the LSPU KOMUNITECH program
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className={`${modalBody} space-y-5 text-sm leading-6`}>
            <section className="space-y-1.5">
              <h3 className="font-semibold text-brand">What this is for</h3>
              <p>
                Every month the Laguna State Polytechnic University – Los Baños
                (LSPU-LBC CAS), which developed this system through its
                KOMUNITECH extension program, asks the barangay for a
                certificate that the system was used. This page prepares it: the
                reporting period, the dates counted and the number of clients
                served are filled in from the system.
              </p>
            </section>
            <section className="space-y-1.5">
              <h3 className="font-semibold text-brand">How to use it</h3>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Choose the month the certificate is for.</li>
                <li>Check the figures below.</li>
                <li>Press Print, on A4 paper.</li>
                <li>
                  Choose the rating and write the remarks below (both are
                  optional; left empty they print as blanks to fill in by hand).
                </li>
                <li>
                  Write the date of issue by hand and have it signed above the
                  printed name (the form is certified by the Head, Office of the
                  Municipal Agriculturist).
                </li>
              </ol>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold text-brand">Month</h3>
              <Select
                id="utilization-month"
                aria-label="Month of the certificate"
                data-testid="utilization-month"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value)
                  setRating(null)
                }}
                searchable={false}
                wrapperClassName="w-full sm:w-64"
              >
                {months.map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                ))}
              </Select>
              <dl className="divide-y rounded-lg border" aria-live="polite">
                <div className="grid grid-cols-[10rem_1fr] gap-x-4 px-3 py-2.5">
                  <dt className="text-muted-foreground">Clients served</dt>
                  <dd className="font-medium" data-testid="utilization-clients">
                    {clients}
                  </dd>
                </div>
                <div className="grid grid-cols-[10rem_1fr] gap-x-4 px-3 py-2.5">
                  <dt className="text-muted-foreground">Documents issued</dt>
                  <dd className="font-medium">
                    {data ? formatLocaleNumber(data.documents_issued) : "…"}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                A client is one resident who received at least one issued
                document in the month, counted once however many times they
                came. Voided and archived documents are not counted.
                {data && data.month_end !== data.month_start
                  ? ` Counted from ${monthName(monthNumber)} ${Number(data.month_start.slice(8))} to ${Number(data.month_end.slice(8))}.`
                  : ""}
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold text-brand">Performance rating</h3>
              <div
                role="group"
                aria-label="Utilization performance rating"
                data-testid="utilization-rating"
                className="grid gap-2 sm:grid-cols-5"
              >
                {SCALE.map(([score, meaning]) => {
                  const picked = rating === Number(score)
                  return (
                    <button
                      key={score}
                      type="button"
                      aria-pressed={picked}
                      data-testid={`utilization-rating-${score}`}
                      onClick={() => setRating(picked ? null : Number(score))}
                      className={`flex min-h-11 flex-col items-center rounded-lg border px-2 py-2 text-center text-xs leading-tight transition-colors ${
                        picked
                          ? "border-brand bg-brand/10 text-brand"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="text-base font-semibold">{score}</span>
                      {meaning}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Optional. Choose the rating to print it on the certificate, or
                leave it empty to write it by hand. Press the chosen rating
                again to clear it.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold text-brand">
                <label htmlFor="utilization-remarks">
                  Remarks / Observations
                </label>
              </h3>
              <textarea
                id="utilization-remarks"
                data-testid="utilization-remarks"
                value={remarks}
                maxLength={REMARKS_MAX}
                rows={4}
                onChange={(event) => setRemarks(event.target.value)}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <p className="text-xs text-muted-foreground">
                Optional. {remarks.length}/{REMARKS_MAX} characters. Printed on
                the lines after "Remarks / Observations:"; left empty, the lines
                stay blank to write by hand.
              </p>
            </section>
          </div>
          <div className={`${modalFooter} flex justify-end gap-2`}>
            <Button
              type="button"
              variant="outline"
              data-testid="info-close"
              onClick={() => onOpenChange(false)}
            >
              {t("common.ui.close")}
            </Button>
            <Button
              type="button"
              data-testid="utilization-print"
              disabled={!data || printing}
              onClick={handlePrint}
            >
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {open && data
        ? createPortal(
            <div className="cou-print-root" aria-hidden="true">
              <UtilizationSheet
                month={month}
                monthStart={data.month_start}
                monthEnd={data.month_end}
                clientsServed={data.clients_served}
                rating={rating}
                remarks={remarks}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
