import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Check, Clock3, Search, UserRoundCheck, X } from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import PendingUsers from "@/components/Pending/PendingUsers"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function getUsersQueryOptions() {
  return {
    queryFn: async () =>
      (await UsersService.readUsers({ query: { skip: 0, limit: 100 } })).data,
    queryKey: ["users"],
  }
}

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  beforeLoad: async () => {
    const { data: user } = await UsersService.readUserMe()
    if (!user.is_superuser) throw redirect({ to: "/" })
  },
  head: () => ({ meta: [{ title: pageTitle("User Accounts") }] }),
})

function UsersTableContent() {
  const { user: currentUser } = useAuth()
  const { data: users } = useSuspenseQuery(getUsersQueryOptions())
  const tableData: UserTableData[] = users.data.map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
  }))
  return <DataTable columns={columns} data={tableData} />
}

function UsersTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent />
    </Suspense>
  )
}

type Registration = {
  username: string
  name: string
  submitted: string
  status: "Pending" | "Approved" | "Rejected"
}

const initialRegistrations: Registration[] = [
  { name: "Staff Applicant 1", username: "staff.applicant1", submitted: "Oct 28, 2026", status: "Pending" },
  { name: "Staff Applicant 2", username: "staff.applicant2", submitted: "Oct 27, 2026", status: "Pending" },
]

function RegistrationReview() {
  const [registrations, setRegistrations] = useState(initialRegistrations)
  const [search, setSearch] = useState("")
  const visibleRegistrations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return registrations.filter((row) =>
      [row.name, row.username, row.submitted, row.status].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [registrations, search])

  const decide = (username: string, status: "Approved" | "Rejected") => {
    setRegistrations((current) =>
      current.map((row) => row.username === username ? { ...row, status } : row),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Pending Registrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review staff registration requests before granting access.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
          <Clock3 className="size-4" />
          {registrations.filter((row) => row.status === "Pending").length} pending
        </span>
      </div>

      <label className="relative block w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicants..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
      </label>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>{["Applicant", "Requested username", "Submitted", "Status", "Actions"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRegistrations.map((row) => (
              <tr key={row.username} className="border-t">
                <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><UserRoundCheck className="size-4 text-muted-foreground" />{row.name}</span></td>
                <td className="px-4 py-4">{row.username}</td>
                <td className="px-4 py-4">{row.submitted}</td>
                <td className="px-4 py-4"><span className="rounded-full border px-2.5 py-1 text-xs">{row.status}</span></td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <button type="button" disabled={row.status !== "Pending"} onClick={() => decide(row.username, "Approved")} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40"><Check className="size-3.5" />Approve</button>
                    <button type="button" disabled={row.status !== "Pending"} onClick={() => decide(row.username, "Rejected")} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40"><X className="size-3.5" />Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRegistrations.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No registrations found.</p> : null}
      </div>
    </div>
  )
}

function Admin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">User Accounts</h1>
          <p className="text-muted-foreground">Manage staff access and registration requests.</p>
        </div>
        <AddUser />
      </div>
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList>
          <TabsTrigger value="accounts">All Accounts</TabsTrigger>
          <TabsTrigger value="registrations">Pending Registrations</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4">
          <UsersTable />
        </TabsContent>
        <TabsContent value="registrations" className="mt-4">
          <RegistrationReview />
        </TabsContent>
      </Tabs>
    </div>
  )
}
