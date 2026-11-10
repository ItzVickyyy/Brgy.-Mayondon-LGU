import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { EllipsisVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  variant?: "default" | "outline" | "secondary"
  disabled?: boolean
  title?: string
  icon?: ReactNode
}

type RowActionsProps = {
  name: string
  isAdmin: boolean
  primary?: RowPrimaryAction
  items?: RowActionItem[]
  leading?: ReactNode // extra control shown before the primary button
}

export function RowActions({
  name,
  isAdmin,
  primary,
  items = [],
  leading,
}: RowActionsProps) {
  const { t } = useTranslation()
  const visibleItems = items.filter(
    (item) => !item.hidden && (!item.adminOnly || isAdmin),
  )

  return (
    <div className="flex items-center justify-end gap-2">
      {leading}
      {primary ? (
        <Button
          type="button"
          size="sm"
          variant={primary.variant ?? "default"}
          onClick={primary.onSelect}
          disabled={primary.disabled}
          title={primary.title}
        >
          {primary.icon}
          {primary.label}
        </Button>
      ) : null}
      {visibleItems.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
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
      ) : null}
    </div>
  )
}
