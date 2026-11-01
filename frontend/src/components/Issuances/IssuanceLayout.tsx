import { FileText } from "lucide-react"
import type { ReactNode } from "react"

export function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof FileText
  label: string
  value: string | number
  hint: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold leading-tight tracking-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}
