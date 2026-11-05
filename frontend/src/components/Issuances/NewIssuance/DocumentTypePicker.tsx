import { cn } from "@/lib/utils"
import { type DocumentCode, documentConfigList } from "./documentConfig"

const groups = [
  { category: "clearance", label: "Clearances" },
  { category: "certification", label: "Certifications" },
  { category: "id", label: "ID" },
] as const

type Props = {
  value: DocumentCode
  onChange: (code: DocumentCode) => void
}

/** Plain text choices, grouped in three short rows. One click picks a document. */
export function DocumentTypePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      {groups.map(({ category, label }) => {
        const items = documentConfigList.filter(
          (item) => item.category === category,
        )
        if (!items.length) return null
        return (
          <fieldset
            key={category}
            className="grid min-w-0 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[7.5rem_1fr]"
          >
            <legend className="sr-only">{label}</legend>
            <span
              aria-hidden="true"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </span>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const selected = item.code === value
                return (
                  <label
                    key={item.code}
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3.5 text-sm transition-colors",
                      "hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                      selected &&
                        "border-brand bg-primary font-medium text-primary-foreground hover:bg-primary",
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
                    {item.shortName}
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
