import { Check } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  id: string
  step: number
  title: string
  description?: string
  done?: boolean
  aside?: ReactNode
  children: ReactNode
}

/** One numbered block of the issuance form. The number turns into a check once the block is complete. */
export function IssuanceSection({
  id,
  step,
  title,
  description,
  done = false,
  aside,
  children,
}: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5"
    >
      <header className="mb-4 flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
            done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-brand/30 bg-brand/10 text-brand",
          )}
        >
          {done ? <Check className="size-4" /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-title`} className="text-base font-semibold leading-8">
            {title}
            {done ? <span className="sr-only"> (complete)</span> : null}
          </h3>
          {description ? (
            <p className="-mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
