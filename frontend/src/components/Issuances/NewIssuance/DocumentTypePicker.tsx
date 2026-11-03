import {
  Bike,
  Briefcase,
  CreditCard,
  HandHeart,
  HeartHandshake,
  House,
  type LucideIcon,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type DocumentCode, documentConfigList } from "./documentConfig"

const icons: Record<DocumentCode, LucideIcon> = {
  BARANGAY_CLEARANCE: ShieldCheck,
  FRANCHISE_CLEARANCE: Bike,
  UTILITY_CLEARANCE: Zap,
  RESIDENCY: House,
  INDIGENCY: HandHeart,
  ASSISTANCE: HeartHandshake,
  MARGINALIZED_SECTOR: Users,
  FIRST_TIME_JOBSEEKER: Briefcase,
  BARANGAY_ID: CreditCard,
}

const groups = [
  { category: "clearance", label: "Clearances" },
  { category: "certification", label: "Certifications" },
  { category: "id", label: "ID" },
] as const

type Props = {
  value: DocumentCode
  onChange: (code: DocumentCode) => void
}

/** Big tappable tiles instead of a dropdown, so the clerk sees every document at once and picks in one click. */
export function DocumentTypePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      {groups.map(({ category, label }) => {
        const items = documentConfigList.filter(
          (item) => item.category === category,
        )
        if (!items.length) return null
        return (
          <fieldset key={category} className="min-w-0">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </legend>
            <div
              role="radiogroup"
              aria-label={label}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
            >
              {items.map((item) => {
                const Icon = icons[item.code]
                const selected = item.code === value
                return (
                  <label
                    key={item.code}
                    className={cn(
                      "flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors",
                      "hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                      selected &&
                        "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <input
                      type="radio"
                      name="issuance-document-type"
                      value={item.code}
                      checked={selected}
                      onChange={() => onChange(item.code)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-md",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">
                        {item.shortName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
