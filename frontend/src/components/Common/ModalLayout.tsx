import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Shared pieces for the larger pop-ups (forms, profile, details). The header
// and footer stay put while only the middle scrolls, so Save is always in
// reach on a short laptop screen. Pass `modalShell` as the DialogContent
// className together with a width such as `sm:max-w-4xl`. (A plain `max-w-*`
// is overridden by the dialog's own `sm:max-w-lg`, so always use `sm:max-w-*`.)
export const modalShell =
  "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0"
// Same fixed height for the resident profile and the add/edit resident form,
// so moving between them does not resize the pop-up.
export const modalTall = "h-[90dvh]"
export const modalHeader =
  "gap-1.5 border-b px-5 py-4 pr-12 sm:px-6 sm:pr-14"
export const modalBody = "min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
export const modalFooter =
  "border-t bg-muted/30 px-5 py-3 sm:px-6 sm:py-4"

/** A titled group of fields inside a pop-up. */
export function ModalSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 w-full border-b pb-2 text-sm font-semibold text-brand">
        {title}
      </legend>
      <div className={cn("grid gap-4", className)}>{children}</div>
    </fieldset>
  )
}
