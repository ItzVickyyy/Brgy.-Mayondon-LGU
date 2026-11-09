import { Link } from "@tanstack/react-router"
import { Landmark } from "lucide-react"

import { SITE } from "@/config/site"
import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
  /** "sidebar" is for the dark navy sidebar: light text, sky-blue mark. */
  tone?: "default" | "sidebar"
}

function Mark({
  className,
  tone = "default",
}: {
  className?: string
  tone?: "default" | "sidebar"
}) {
  // Uses the official logo once SITE.logo is set; otherwise a placeholder icon.
  if (SITE.logo) {
    return (
      <img
        src={SITE.logo}
        alt={`${SITE.fullName} logo`}
        className={cn("size-8 shrink-0 object-contain", className)}
      />
    )
  }
  return (
    <Landmark
      aria-hidden
      className={cn(
        "size-6 shrink-0",
        tone === "sidebar" ? "text-sidebar-primary" : "text-brand",
        className,
      )}
    />
  )
}

function Wordmark({
  className,
  tone = "default",
}: {
  className?: string
  tone?: "default" | "sidebar"
}) {
  return (
    <span className={cn("flex flex-col leading-tight", className)}>
      <span className="font-semibold">{SITE.shortName}</span>
      <span
        className={cn(
          "text-xs",
          tone === "sidebar"
            ? "text-sidebar-foreground/65"
            : "text-muted-foreground",
        )}
      >
        {SITE.location}
      </span>
    </span>
  )
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
  tone = "default",
}: LogoProps) {
  const content =
    variant === "responsive" ? (
      <span className="flex items-center gap-2">
        <Mark tone={tone} />
        <Wordmark
          tone={tone}
          className="whitespace-nowrap transition-opacity duration-150 ease-out group-data-[collapsible=icon]:opacity-0 group-data-[state=expanded]:delay-150"
        />
      </span>
    ) : variant === "icon" ? (
      <Mark className={className} tone={tone} />
    ) : (
      <span className="flex items-center gap-3">
        <Mark className={cn("size-10", className)} tone={tone} />
        <Wordmark className="text-lg" tone={tone} />
      </span>
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
