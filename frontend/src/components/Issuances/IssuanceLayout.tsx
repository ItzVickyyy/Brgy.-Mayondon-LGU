import type { LucideIcon } from "lucide-react"
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
  return <StatCard icon={Icon} label={label} value={value} description={hint} />
}
