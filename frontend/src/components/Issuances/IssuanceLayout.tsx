import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { StatCard } from "@/components/Common/StatCard"

export function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint: string
}) {
  return (
    <StatCard icon={Icon} label={label} value={value} description={hint} />
  )
}

export function FormSection({
  title,
  description,
  children,
  step,
}: {
  title: string
  description?: string
  children: ReactNode
  step?: number
}) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2"><span className={step ? "flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" : "hidden"} aria-hidden="true">{step}</span><h3 className="font-semibold tracking-tight">{title}</h3></div>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}
