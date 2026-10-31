import { Link } from "@tanstack/react-router"
import { Landmark } from "lucide-react"

import { SITE } from "@/config/site"
import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

function Mark({ className }: { className?: string }) {
  // Uses the official logo once SITE.logo is set; otherwise a placeholder icon.
  if (SITE.logo) {
    return (
      <img
        src={SITE.logo}
        alt={`${SITE.fullName} logo`}
        className={cn("size-8 object-contain", className)}
      />
    )
  }
  return (
    <Landmark aria-hidden className={cn("size-6 text-primary", className)} />
  )
}

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col leading-tight", className)}>
      <span className="font-semibold">{SITE.shortName}</span>
      <span className="text-muted-foreground text-xs">{SITE.location}</span>
    </span>
  )
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content =
    variant === "responsive" ? (
      <span className="flex items-center gap-2">
        <Mark />
        <Wordmark className="group-data-[collapsible=icon]:hidden" />
      </span>
    ) : variant === "icon" ? (
      <Mark className={className} />
    ) : (
      <span className="flex items-center gap-3">
        <Mark className={cn("size-10", className)} />
        <Wordmark className="text-lg" />
      </span>
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
