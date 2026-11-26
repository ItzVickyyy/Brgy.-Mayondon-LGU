import { EllipsisVertical } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type RowActionItem = {
  label: string
  onSelect: () => void
  adminOnly?: boolean
  destructive?: boolean
  hidden?: boolean
  disabled?: boolean
  title?: string
  icon?: ReactNode
}

export type RowPrimaryAction = {
  label: string
  onSelect: () => void
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "tintBlue"
    | "tintGreen"
    | "tintTeal"
    | "tintAmber"
    | "tintRose"
    | "tintViolet"
  disabled?: boolean
  title?: string
  /** Spoken name when the visible label is too short on its own (e.g. "Print for Maria Santos"). */
  ariaLabel?: string
  icon?: ReactNode
}

type RowActionsProps = {
  name: string
  isAdmin: boolean
  primary?: RowPrimaryAction
  /** More buttons shown right after the primary one (never hidden in the three-dot menu). */
  actions?: RowPrimaryAction[]
  items?: RowActionItem[]
  leading?: ReactNode // extra control shown before the primary button
  /** Tighter gaps and button padding, for a table that must fit a 1280 px screen. */
  compact?: boolean
  /** Extra classes for the wrapper (e.g. left-aligned wrapping inside a card). */
  className?: string
}

/**
 * One text button of an Actions column. A disabled button ignores the mouse, so when it has a
 * `title` (the reason it is disabled) the button sits in a focusable wrapper that shows the reason
 * as a small tooltip on hover and keyboard focus. An enabled button keeps the plain `title` hint.
 */
function ActionButton({
  action,
  compact,
}: {
  action: RowPrimaryAction
  compact: boolean
}) {
  const showReason = Boolean(action.disabled && action.title)
  const button = (
    <Button
      type="button"
      size="sm"
      variant={action.variant ?? "outline"}
      onClick={action.onSelect}
      disabled={action.disabled}
      title={showReason ? undefined : action.title}
      aria-label={action.ariaLabel}
      className={compact ? "px-2.5" : undefined}
    >
      {action.icon}
      {action.label}
    </Button>
  )
  if (!showReason) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled button cannot take focus or hover, so its wrapper does, to show the reason
          tabIndex={0}
          data-testid="disabled-reason-trigger"
          className="inline-flex cursor-not-allowed rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-56">
        {action.title}
      </TooltipContent>
    </Tooltip>
  )
}

export function RowActions({
  name,
  isAdmin,
  primary,
  actions = [],
  items = [],
  leading,
  compact = false,
  className = "",
}: RowActionsProps) {
  const { t } = useTranslation()
  const visibleItems = items.filter(
    (item) => !item.hidden && (!item.adminOnly || isAdmin),
  )

  const row = (
    <div
      className={`flex items-center justify-end ${compact ? "gap-1.5" : "gap-2"} ${className}`}
    >
      {leading}
      {primary ? <ActionButton action={primary} compact={compact} /> : null}
      {actions.map((action) => (
        <ActionButton key={action.label} action={action} compact={compact} />
      ))}
      {visibleItems.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="tintMore"
              size="icon"
              aria-label={t("common.rowActions.more", { name })}
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {visibleItems.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                title={item.title}
                onSelect={item.onSelect}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : items.length > 0 ? (
        // Keeps the buttons of rows without a menu lined up with the other rows.
        <span aria-hidden="true" className="size-11 shrink-0" />
      ) : null}
    </div>
  )
  return row
}
