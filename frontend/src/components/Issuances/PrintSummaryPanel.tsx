import { AlertCircle, CheckCircle2 } from "lucide-react"
import { statusStyles } from "@/components/Common/statusStyles"
import { formatPaperDate } from "@/lib/issuance-format"
import type { DocumentField } from "@/components/Issuances/config"
import { getMissingFields, getPrintRows } from "@/components/Issuances/print-summary"
import { cn } from "@/lib/utils"

type PrintSummaryPanelProps = {
  type: string
  values: Record<string, string>
  currentDate: string
  fields: DocumentField[]
}

export function PrintSummaryPanel({ type, values, currentDate, fields }: PrintSummaryPanelProps) {
  const rows = getPrintRows(type, values, currentDate)
  const missing = getMissingFields(type, values, fields)

  return (
    <div className="min-w-0 break-words rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-0">
      <h3 className="font-semibold tracking-tight">Will print</h3>
      <p className="mt-1 break-words text-sm text-muted-foreground">{type}</p>
      <p className="mt-1 text-sm font-medium">{formatPaperDate(currentDate)}</p>
      <div className="my-4 border-t" />
      <dl className="space-y-3 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2">
            <dt className="min-w-0 break-words text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className={cn("min-w-0 break-words text-right text-sm", !value && "font-medium text-amber-600")}>
              {value || <span className="inline-flex items-center gap-1"><AlertCircle className="size-3.5" aria-hidden="true" />Missing</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="my-4 border-t" />
      {missing.length ? (
        <>
          <p className="text-sm font-semibold">Missing ({missing.length})</p>
          <ul className="mt-2 space-y-1 text-sm">
            {missing.map((field) => <li key={field.name}><button type="button" className="min-h-8 max-w-full break-words text-left text-amber-700 underline underline-offset-4" onClick={() => { const target = document.getElementById(`field-${field.name}`); target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.focus() }}>{field.label}</button></li>)}
          </ul>
        </>
      ) : (
        <p className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", statusStyles.Issued)}>
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />Ready to issue
        </p>
      )}
      <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">After printing: {type === "Barangay Clearance" ? "Resident signs and thumbmarks; apply the dry seal." : type === "Certification (assistance request)" ? "Kagawad signs." : "Apply the dry seal."}</p>
    </div>
  )
}
