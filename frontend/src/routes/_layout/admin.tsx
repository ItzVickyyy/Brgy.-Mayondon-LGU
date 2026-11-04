import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useState } from "react"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import { formControlClass } from "@/components/Common/formStyles"
import { EmptyState, ErrorState, LoadingState } from "@/components/Common/FeedbackState"
import { NoPermission } from "@/components/Common/NoPermission"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

function getUsersQueryOptions() {
  return {
    queryFn: async () =>
      (await UsersService.readUsers({ query: { skip: 0, limit: 100 } })).data,
    queryKey: ["users"],
  }
}

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  head: () => ({ meta: [{ title: pageTitle("User Accounts") }] }),
})

function UsersTable() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "staff">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const {
    data: users,
    isLoading,
    isError,
    refetch,
  } = useQuery(getUsersQueryOptions())

  if (isLoading) return <LoadingState title="Loading user accounts..." />
  if (isError) {
    return (
      <ErrorState
        title="Unable to load user accounts"
        description="Check your connection and try again."
        onRetry={() => void refetch()}
      />
    )
  }

  const sourceUsers = users?.data ?? []
  const activeAdminCount = sourceUsers.filter(
    (user) => user.is_superuser && user.is_active,
  ).length
  const tableData: UserTableData[] = sourceUsers
    .map((user: UserPublic) => ({
      ...user,
      isCurrentUser: currentUser?.id === user.id,
      isLastActiveAdmin: Boolean(
        user.is_superuser && user.is_active && activeAdminCount <= 1,
      ),
    }))
    .sort(
      (a, b) =>
        Number(b.is_superuser) - Number(a.is_superuser) ||
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
    )

  const query = search.trim().toLowerCase()
  const visibleData = tableData.filter((user) => {
    const matchesSearch = [user.full_name ?? "", user.email].some((value) =>
      value.toLowerCase().includes(query),
    )
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "admin" ? user.is_superuser : !user.is_superuser)
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? user.is_active : !user.is_active)
    return matchesSearch && matchesRole && matchesStatus
  })

  if (tableData.length === 0) {
    return (
      <EmptyState
        title="No user accounts found"
        description="Add a user account to get started."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search user accounts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className={`${formControlClass} pl-9`}
          />
        </label>
        <label className="sm:w-52">
          <span className="sr-only">Filter by role</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | "admin" | "staff")} className={formControlClass}>
            <option value="all">All roles</option>
            <option value="admin">System Administrator</option>
            <option value="staff">Staff</option>
          </select>
        </label>
        <label className="sm:w-44">
          <span className="sr-only">Filter by account status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")} className={formControlClass}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <div className="px-4 text-xs text-muted-foreground sm:px-5">
        Showing {visibleData.length} of {tableData.length} accounts
      </div>
      <DataTable
        columns={columns}
        data={visibleData}
        emptyTitle="No matching user accounts"
        emptyDescription="Try a different search, role, or status filter."
      />
    </div>
  )
}

function Admin() {
  const { user } = useAuth()
  if (!isSystemAdministrator(user)) return <NoPermission />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            User Accounts
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage system users and their access roles.
          </p>
        </div>
        <AddUser />
      </div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4 sm:p-5">
          <h2 className="font-semibold tracking-tight">User Accounts List</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system user access, roles, and account status.
          </p>
        </div>
        <UsersTable />
      </section>
    </div>
  )
}
