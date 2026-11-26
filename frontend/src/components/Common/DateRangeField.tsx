import { cn } from "@/lib/utils"

/**
 * One field for a "from – to" pair of days (290): a single label and a single
 * bordered box that holds both native date inputs, instead of two separate
 * labelled fields. Each input keeps its own accessible name.
 */
export function DateRangeField({
  label,
  fromLabel,
  toLabel,
  from,
  to,
  onFromChange,
  onToChange,
  max,
  className,
}: {
  /** Visible label above the field, e.g. "Dated". */
  label: string
  /** Accessible names of the two inputs, e.g. "Dated from", "Dated to". */
  fromLabel: string
  toLabel: string
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  /** Latest day that can be picked in either box (YYYY-MM-DD). */
  max?: string
  className?: string
}) {
  const input =
    "h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none"
  return (
    <fieldset
      className={cn(
        "m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true">{label}</span>
      <div className="flex h-11 w-full items-center rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow,border-color] hover:border-ring/50 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <input
          type="date"
          aria-label={fromLabel}
          value={from}
          max={to || max}
          onChange={(event) => onFromChange(event.target.value)}
          className={input}
        />
        <span aria-hidden="true" className="px-0.5 text-muted-foreground">
          –
        </span>
        <input
          type="date"
          aria-label={toLabel}
          value={to}
          min={from || undefined}
          max={max}
          onChange={(event) => onToChange(event.target.value)}
          className={input}
        />
      </div>
    </fieldset>
  )
}
