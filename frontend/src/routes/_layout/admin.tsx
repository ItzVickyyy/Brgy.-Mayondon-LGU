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

  const tableData: UserTableData[] = (users?.data ?? []).map(
    (user: UserPublic) => ({
      ...user,
      isCurrentUser: currentUser?.id === user.id,
    }),
  )

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            User Accounts
          </h1>
          <p className="text-muted-foreground">
            Manage system users and their access roles.
          </p>
        </div>
        <AddUser />
      </div>
      <UsersTable />
    </div>
  )
}
