import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The message under an input box ("Invalid email address", "Fill this in").
 * The line is ALWAYS in the page, with a fixed height, and only its text comes
 * and goes. Adding and removing the element used to push every field below it
 * down and up while the person typed.
 */
export function FieldError({
  id,
  className,
  children,
}: {
  id?: string
  className?: string
  children?: ReactNode
}) {
  const has = Boolean(children)
  return (
    <span
      id={has ? id : undefined}
      role={has ? "alert" : undefined}
      className={cn(
        "block min-h-4 text-xs font-normal leading-4 text-destructive",
        className,
      )}
    >
      {children}
    </span>
  )
}
