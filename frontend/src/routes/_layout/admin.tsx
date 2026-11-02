import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
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
  const tableData: UserTableData[] = sourceUsers.map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
    isLastActiveAdmin:
      user.is_superuser && user.is_active && activeAdminCount <= 1,
  }))

  if (tableData.length === 0) {
    return (
      <EmptyState
        title="No user accounts found"
        description="Add a user account to get started."
      />
    )
  }

  return <DataTable columns={columns} data={tableData} />
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
