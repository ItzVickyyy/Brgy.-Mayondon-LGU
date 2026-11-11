import { useTranslation } from "react-i18next"
import { documentShortName } from "@/lib/issuanceLabels"
import { cn } from "@/lib/utils"
import { type DocumentCode, documentConfigList } from "./documentConfig"

const groups = ["clearance", "certification", "id"] as const

type Props = {
  value: DocumentCode
  onChange: (code: DocumentCode) => void
  /** A correction keeps the document it started from. */
  disabled?: boolean
}

/** Plain text choices, grouped in three short rows. One click picks a document. */
export function DocumentTypePicker({ value, onChange, disabled }: Props) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      {groups.map((category) => {
        const label = t(`issuances.new.groups.${category}`)
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
                      "relative inline-flex h-11 cursor-pointer items-center rounded-md border bg-background px-3.5 text-sm transition-colors sm:h-9",
                      "hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                      disabled &&
                        "cursor-not-allowed opacity-60 hover:bg-background",
                      selected &&
                        "border-brand bg-primary font-medium text-primary-foreground hover:bg-primary",
                    )}
                  >
                    <input
                      type="radio"
                      name="issuance-document-type"
                      value={item.code}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => onChange(item.code)}
                      className="sr-only"
                    />
                    {documentShortName(item.code, t)}
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
