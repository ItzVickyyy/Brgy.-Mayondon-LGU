import { createFileRoute } from "@tanstack/react-router"
import { Search, UserRound } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { NoPermission } from "@/components/Common/NoPermission"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export const Route = createFileRoute("/_layout/officials")({
  component: OfficialsManagement,
  head: () => ({ meta: [{ title: pageTitle("Officials") }] }),
})

const sampleOfficials = [
  {
    id: "OFF-001",
    name: "Barangay Captain",
    position: "Punong Barangay",
    term: "Current term",
  },
  {
    id: "OFF-002",
    name: "Barangay Kagawad 1",
    position: "Barangay Kagawad",
    term: "Current term",
  },
  {
    id: "OFF-003",
    name: "Barangay Secretary",
    position: "Barangay Secretary",
    term: "Current term",
  },
  {
    id: "OFF-004",
    name: "Barangay Treasurer",
    position: "Barangay Treasurer",
    term: "Current term",
  },
]

function OfficialsManagement() {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const filteredOfficials = useMemo(
    () =>
      sampleOfficials.filter((official) =>
        [official.id, official.name, official.position, official.term].some(
          (value) => value.toLowerCase().includes(search.toLowerCase()),
        ),
      ),
    [search],
  )

  if (!isSystemAdministrator(user)) return <NoPermission />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Officials
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Maintain the list of barangay officials and their terms.
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <UserRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">Officials List</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search the list of barangay officials.
              </p>
            </div>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search officials..."
              className={`${formControlClass} pl-9`}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Official ID</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Name</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Position</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Term / Period</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOfficials.map((official) => (
                <tr key={official.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 align-middle font-medium sm:px-5">{official.id}</td>
                  <td className="px-4 py-3 align-middle font-medium sm:px-5">{official.name}</td>
                  <td className="px-4 py-3 align-middle sm:px-5">{official.position}</td>
                  <td className="px-4 py-3 align-middle sm:px-5">{official.term}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOfficials.length === 0 && (
            <EmptyState
              title="No matching officials"
              description="Try a different name or position."
            />
          )}
        </div>
        <div className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
          Showing {filteredOfficials.length} record{filteredOfficials.length === 1 ? "" : "s"}
        </div>
      </section>
    </div>
  )
}
