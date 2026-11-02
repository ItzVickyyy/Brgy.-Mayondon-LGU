import type { FileText } from "lucide-react"
import type { ReactNode } from "react"
import { StatCard } from "@/components/Common/StatCard"

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
    <StatCard icon={Icon} label={label} value={value} description={hint} />
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
        <h3 className="font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}
