import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { type UserTableData, useUserColumns } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import { formControlClass } from "@/components/Common/formStyles"
import { Select } from "@/components/Common/Select"
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
  const { t } = useTranslation()
  const columns = useUserColumns()
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

  if (isLoading) return <LoadingState title={t("admin.users.loading")} />
  if (isError) {
    return (
      <ErrorState
        title={t("admin.users.loadError.title")}
        description={t("admin.users.loadError.description")}
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
        title={t("admin.users.empty.title")}
        description={t("admin.users.empty.description")}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">{t("admin.users.searchLabel")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.users.searchPlaceholder")}
            className={`${formControlClass} pl-9`}
          />
        </label>
        <label className="sm:w-52">
          <span className="sr-only">{t("admin.users.filterRole")}</span>
          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | "admin" | "staff")} className={formControlClass}>
            <option value="all">{t("admin.users.allRoles")}</option>
            <option value="admin">{t("admin.users.roleAdmin")}</option>
            <option value="staff">{t("admin.users.roleStaff")}</option>
          </Select>
        </label>
        <label className="sm:w-44">
          <span className="sr-only">{t("admin.users.filterStatus")}</span>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")} className={formControlClass}>
            <option value="all">{t("admin.users.allStatuses")}</option>
            <option value="active">{t("admin.users.active")}</option>
            <option value="inactive">{t("admin.users.inactive")}</option>
          </Select>
        </label>
      </div>
      <DataTable
        columns={columns}
        data={visibleData}
        emptyTitle={t("admin.users.noMatch.title")}
        emptyDescription={t("admin.users.noMatch.description")}
      />
    </div>
  )
}

function Admin() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!isSystemAdministrator(user)) return <NoPermission />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.users.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("admin.users.subtitle")}
          </p>
        </div>
        <AddUser />
      </div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4 sm:p-5">
          <h2 className="font-semibold tracking-tight">{t("admin.users.listTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.users.listDescription")}
          </p>
        </div>
        <UsersTable />
      </section>
    </div>
  )
}
