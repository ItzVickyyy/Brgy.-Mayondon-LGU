import { createFileRoute } from "@tanstack/react-router"
import { Info, Search, UserRound } from "lucide-react"
import { useMemo, useState } from "react"

import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/officials")({
  component: OfficialsManagement,
  head: () => ({ meta: [{ title: pageTitle("Officials") }] }),
})

const sampleOfficials = [
  { id: "OFF-001", name: "Sample Official One", position: "Barangay Captain", term: "Sample term" },
  { id: "OFF-002", name: "Sample Official Two", position: "Barangay Kagawad", term: "Sample term" },
  { id: "OFF-003", name: "Sample Official Three", position: "Barangay Secretary", term: "Sample term" },
  { id: "OFF-004", name: "Sample Official Four", position: "Barangay Treasurer", term: "Sample term" },
]

function OfficialsManagement() {
  const [search, setSearch] = useState("")
  const filteredOfficials = useMemo(() => sampleOfficials.filter((official) =>
    [official.id, official.name, official.position, official.term].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  ), [search])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin Portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Officials</h1>
        <p className="mt-2 text-sm text-muted-foreground">A proposed page for maintaining barangay officials and their terms.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>Draft preview using fictional names and positions. The official list, fields, and whether this module is needed must be confirmed with the barangay.</p>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><UserRound className="size-5" aria-hidden="true" /></div>
            <div><h2 className="font-semibold">Officials List</h2><p className="mt-1 text-sm text-muted-foreground">Search the sample list below.</p></div>
          </div>
          <label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search officials..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Official ID</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Position</th><th className="px-4 py-3 font-medium">Term / Period</th></tr></thead>
            <tbody className="divide-y">{filteredOfficials.map((official) => <tr key={official.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{official.id}</td><td className="px-4 py-3">{official.name}</td><td className="px-4 py-3">{official.position}</td><td className="px-4 py-3">{official.term}</td></tr>)}</tbody>
          </table>
          {filteredOfficials.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No sample officials match your search.</p>}
        </div>
      </section>
    </div>
  )
}
