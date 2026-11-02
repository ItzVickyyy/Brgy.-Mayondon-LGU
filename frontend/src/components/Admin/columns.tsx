import type { ColumnDef } from "@tanstack/react-table"

import type { UserPublic } from "@/client"
import type { DataTableFeatures } from "@/components/Common/DataTable"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { UserActionsMenu } from "./UserActionsMenu"

export type UserTableData = UserPublic & {
  isCurrentUser: boolean
  isLastActiveAdmin: boolean
}

export const columns: ColumnDef<DataTableFeatures, UserTableData>[] = [
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => {
      const fullName = row.original.full_name
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn("font-medium", !fullName && "text-muted-foreground")}
          >
            {fullName || "N/A"}
          </span>
          {row.original.isCurrentUser && (
            <Badge variant="outline" className="text-xs">
              You
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "email",
    header: "Email / Username",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
  },
  {
    id: "role",
    header: "Role",
    cell: ({ row }) => (
      <Badge variant="outline" className={row.original.is_superuser ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}>
        {row.original.is_superuser ? "System Administrator" : "Staff"}
      </Badge>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className={statusStyles[row.original.is_active ? "Active" : "Inactive"]}>
        {row.original.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span className="block text-right">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UserActionsMenu user={row.original} />
      </div>
    ),
  },
]
