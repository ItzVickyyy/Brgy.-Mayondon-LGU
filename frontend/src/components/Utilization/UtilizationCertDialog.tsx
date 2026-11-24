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
import { UtilizationSheet } from "./UtilizationSheet"

const A4_PAGE_RULE = "@page { size: 210mm 297mm; margin: 0 }"
const IMAGE_WAIT_MS = 3000
// Kept after window.print() returns, so a browser whose print() does not block never loses the sheet.
const PRINT_GRACE_MS = 1000

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
 * Utilization every month. The page fills in the month, the number of clients served and the Punong
 * Barangay by itself; the date of issue and the signature stay blank for the office to complete.
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

  // Prints the certificate only: index.css hides everything else while the body carries
  // "cou-printing", and a dark theme is printed as light. Chrome fires "afterprint" as soon as the
  // preview is drawn and lays the page out again whenever a setting in the preview changes, so the
  // print state must not end on that event (the preview would go blank): it ends when the blocking
  // window.print() call returns, as the issuance print does.
  useEffect(() => {
    if (!printing) return
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    let cancelled = false
    const pageStyle = document.createElement("style")
    pageStyle.setAttribute("data-cou-page", "")
    pageStyle.textContent = A4_PAGE_RULE
    document.head.appendChild(pageStyle)
    document.body.classList.add("cou-printing")
    root.classList.remove("dark")
    void (async () => {
      try {
        await waitForSheetImages()
        // requestAnimationFrame never fires in a background tab, so a timer is the fallback.
        await new Promise((resolve) => {
          requestAnimationFrame(() => resolve(null))
          window.setTimeout(() => resolve(null), 250)
        })
        if (!cancelled) window.print() // blocks until the print dialog closes in most browsers
        await new Promise((resolve) =>
          window.setTimeout(resolve, PRINT_GRACE_MS),
        )
      } finally {
        if (!cancelled) setPrinting(false)
      }
    })()
    return () => {
      cancelled = true
      pageStyle.remove()
      document.body.classList.remove("cou-printing")
      if (wasDark) root.classList.add("dark")
    }
  }, [printing])

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
                month, the number of clients served and the name of the Punong
                Barangay are filled in from the system.
              </p>
            </section>
            <section className="space-y-1.5">
              <h3 className="font-semibold text-brand">How to use it</h3>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Choose the month the certificate is for.</li>
                <li>Check the figures below.</li>
                <li>Press Print, on A4 paper.</li>
                <li>
                  Write the date of issue by hand, and have the Punong Barangay
                  sign above the printed name.
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
                onChange={(event) => setMonth(event.target.value)}
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
                <div className="grid grid-cols-[10rem_1fr] gap-x-4 px-3 py-2.5">
                  <dt className="text-muted-foreground">Punong Barangay</dt>
                  <dd className="font-medium">
                    {data
                      ? (data.punong_barangay ?? "Not set in Officials")
                      : "…"}
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
              {data && data.punong_barangay === null ? (
                <p
                  role="note"
                  className="rounded-md border-l-2 border-brand bg-muted/60 px-3 py-2"
                >
                  No current Punong Barangay is set under Officials, so the name
                  line will print blank. Add the official first, or write the
                  name by hand.
                </p>
              ) : null}
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
      {data && (open || printing)
        ? createPortal(
            <div className="cou-print-root" aria-hidden="true">
              <UtilizationSheet
                month={month}
                clientsServed={data.clients_served}
                punongBarangay={data.punong_barangay}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
