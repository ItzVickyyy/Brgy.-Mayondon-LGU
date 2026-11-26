import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { UserPublic } from "@/client"
import type { DataTableFeatures } from "@/components/Common/DataTable"
import {
  badgeTone,
  roleStyles,
  statusStyles,
} from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { UserActionsMenu } from "./UserActionsMenu"

export type UserTableData = UserPublic & {
  isCurrentUser: boolean
  isLastActiveAdmin: boolean
}

export function useUserColumns(): ColumnDef<
  DataTableFeatures,
  UserTableData
>[] {
  const { t } = useTranslation()
  return useMemo<ColumnDef<DataTableFeatures, UserTableData>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: t("admin.users.columns.name"),
        cell: ({ row }) => {
          const fullName = row.original.full_name
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "font-medium",
                  !fullName && "text-muted-foreground",
                )}
              >
                {fullName || t("admin.users.na")}
              </span>
              {row.original.isCurrentUser && (
                <Badge variant="outline" className={badgeTone.blue}>
                  {t("admin.users.you")}
                </Badge>
              )}
              {row.original.must_change_password && (
                <Badge variant="outline" className={badgeTone.amber}>
                  {t("admin.users.tempPassword")}
                </Badge>
              )}
              {row.original.locked_until && (
                <Badge
                  variant="outline"
                  className={`h-auto max-w-full whitespace-normal ${badgeTone.red}`}
                >
                  {t("admin.users.lockedUntil", {
                    time: new Date(
                      row.original.locked_until,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "email",
        header: t("admin.users.columns.email"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        id: "role",
        header: t("admin.users.columns.role"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.is_superuser ? roleStyles.admin : roleStyles.staff
            }
          >
            {row.original.is_superuser
              ? t("admin.users.roleAdmin")
              : t("admin.users.roleStaff")}
          </Badge>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("admin.users.columns.status"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              statusStyles[row.original.is_active ? "Active" : "Inactive"]
            }
          >
            {row.original.is_active
              ? t("admin.users.active")
              : t("admin.users.inactive")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className="block text-center">
            {t("admin.users.columns.actions")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end @max-[80rem]/wide-cards:justify-start">
            <UserActionsMenu key={row.original.id} user={row.original} />
          </div>
        ),
      },
    ],
    [t],
  )
}
