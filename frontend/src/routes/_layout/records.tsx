import { createFileRoute } from "@tanstack/react-router"
import { Search, Users, House, Vote } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/records")({
  component: RecordsManagement,
  head: () => ({ meta: [{ title: pageTitle("Records Management") }] }),
})

type RecordType = "residents" | "households" | "voters"

const residents = [
  { id: "RES-0001", name: "Sample Resident One", household: "HH-0001", sex: "Female", age: "34", voter: "Registered" },
  { id: "RES-0002", name: "Sample Resident Two", household: "HH-0001", sex: "Male", age: "39", voter: "Registered" },
  { id: "RES-0003", name: "Sample Resident Three", household: "HH-0002", sex: "Female", age: "22", voter: "Not registered" },
  { id: "RES-0004", name: "Sample Resident Four", household: "HH-0003", sex: "Male", age: "58", voter: "Registered" },
]

const households = [
  { id: "HH-0001", head: "Sample Household Head One", members: "4", address: "Sample Street 1" },
  { id: "HH-0002", head: "Sample Household Head Two", members: "3", address: "Sample Street 2" },
  { id: "HH-0003", head: "Sample Household Head Three", members: "5", address: "Sample Street 3" },
]

const voters = residents.filter((resident) => resident.voter === "Registered")

function RecordsManagement() {
  const [recordType, setRecordType] = useState<RecordType>("residents")
  const [search, setSearch] = useState("")

  const filteredResidents = useMemo(() => residents.filter((item) =>
    [item.id, item.name, item.household, item.sex, item.voter].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  ), [search])
  const filteredHouseholds = useMemo(() => households.filter((item) =>
    [item.id, item.head, item.address].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  ), [search])
  const filteredVoters = useMemo(() => voters.filter((item) =>
    [item.id, item.name, item.household].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  ), [search])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin Portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Records Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">Organize resident, household, and voter records in one place.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { type: "residents" as const, label: "Residents", count: "12,480", icon: Users },
          { type: "households" as const, label: "Households", count: "3,126", icon: House },
          { type: "voters" as const, label: "Registered Voters", count: "7,842", icon: Vote },
        ].map((item) => (
          <button key={item.type} type="button" onClick={() => { setRecordType(item.type); setSearch("") }} className={`rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 ${recordType === item.type ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
              <item.icon className="size-5 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.count}</p>
            <p className="mt-1 text-xs text-muted-foreground">Illustrative count</p>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{recordType === "residents" ? "Residents" : recordType === "households" ? "Households" : "Registered Voters"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search the sample list below.</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        </div>
        <div className="overflow-x-auto">
          {recordType === "residents" ? (
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Resident ID</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Household</th><th className="px-4 py-3 font-medium">Sex</th><th className="px-4 py-3 font-medium">Age</th><th className="px-4 py-3 font-medium">Voter Status</th></tr></thead>
              <tbody className="divide-y">{filteredResidents.map((item) => <tr key={item.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{item.id}</td><td className="px-4 py-3">{item.name}</td><td className="px-4 py-3">{item.household}</td><td className="px-4 py-3">{item.sex}</td><td className="px-4 py-3">{item.age}</td><td className="px-4 py-3">{item.voter}</td></tr>)}</tbody>
            </table>
          ) : recordType === "households" ? (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Household ID</th><th className="px-4 py-3 font-medium">Household Head</th><th className="px-4 py-3 font-medium">Members</th><th className="px-4 py-3 font-medium">Sample Address</th></tr></thead>
              <tbody className="divide-y">{filteredHouseholds.map((item) => <tr key={item.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{item.id}</td><td className="px-4 py-3">{item.head}</td><td className="px-4 py-3">{item.members}</td><td className="px-4 py-3">{item.address}</td></tr>)}</tbody>
            </table>
          ) : (
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Resident ID</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Household</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
              <tbody className="divide-y">{filteredVoters.map((item) => <tr key={item.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{item.id}</td><td className="px-4 py-3">{item.name}</td><td className="px-4 py-3">{item.household}</td><td className="px-4 py-3">Registered</td></tr>)}</tbody>
            </table>
          )}
          {((recordType === "residents" && filteredResidents.length === 0) || (recordType === "households" && filteredHouseholds.length === 0) || (recordType === "voters" && filteredVoters.length === 0)) && <p className="p-8 text-center text-sm text-muted-foreground">No sample records match your search.</p>}
        </div>
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">Displayed rows are fictional and intended only to help review the proposed layout.</div>
      </section>
    </div>
  )
}
