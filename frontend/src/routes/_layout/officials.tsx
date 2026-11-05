import { createFileRoute } from "@tanstack/react-router"
import { initialOfficials, type OfficialRecord } from "@/components/Officials/officials-sample-data"
import { Search, UserRound, UserRoundPlus } from "lucide-react"
import { useMemo, useState } from "react"

import { EmptyState } from "@/components/Common/FeedbackState"
import { TablePagination, usePagination } from "@/components/Common/TablePagination"
import { formControlClass } from "@/components/Common/formStyles"
import { RowActions } from "@/components/Common/RowActions"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NoPermission } from "@/components/Common/NoPermission"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

const electedPositions = new Set(["Punong Barangay", "Barangay Kagawad", "SK Chairperson"])

function isElectedPosition(value: string) {
  return electedPositions.has(value)
}

export const Route = createFileRoute("/_layout/officials")({
  component: OfficialsManagement,
  head: () => ({ meta: [{ title: pageTitle("Officials") }] }),
})

const positionRank: Record<string, number> = {
  "Punong Barangay": 0,
  "Barangay Kagawad": 1,
  "SK Chairperson": 2,
  "Barangay Secretary": 3,
  "Barangay Treasurer": 4,
  "OIC Kagawad": 2,
  "Barangay Clerk": 5,
  "Administrative Assistant": 6,
}

function formatTermDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function OfficialsManagement() {
  const { user } = useAuth()
  const [officials, setOfficials] = useState(initialOfficials)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"Current" | "Former" | "all">("Current")
  const [formOpen, setFormOpen] = useState(false)
  const [editingOfficial, setEditingOfficial] = useState<OfficialRecord | null>(null)
  const [viewOfficial, setViewOfficial] = useState<OfficialRecord | null>(null)
  const [endTermOfficial, setEndTermOfficial] = useState<OfficialRecord | null>(null)
  const [termEndDate, setTermEndDate] = useState("2026-11-30")
  const [name, setName] = useState("")
  const [position, setPosition] = useState("Punong Barangay")
  const [termStart, setTermStart] = useState("2026-11-01")
  const [termEnd, setTermEnd] = useState("2029-10-31")

  const filteredOfficials = useMemo(() => {
    const query = search.trim().toLowerCase()
    return officials
      .filter((official) => {
        const matchesSearch = [official.name, official.position, official.status].some((value) =>
          value.toLowerCase().includes(query),
        )
        return matchesSearch && (statusFilter === "all" || official.status === statusFilter)
      })
      .sort((a, b) =>
        (positionRank[a.position] ?? 99) - (positionRank[b.position] ?? 99) ||
        a.name.localeCompare(b.name),
      )
  }, [officials, search, statusFilter])
  const officialPagination = usePagination(filteredOfficials, 10, search + "|" + statusFilter)

  if (!isSystemAdministrator(user)) return <NoPermission />

  function openAddForm() {
    setEditingOfficial(null)
    setName("")
    setPosition("Punong Barangay")
    setTermStart("2026-11-01")
    setTermEnd("2029-10-31")
    setFormOpen(true)
  }

  function openEditForm(official: OfficialRecord) {
    setEditingOfficial(official)
    setName(official.name)
    setPosition(official.position)
    setTermStart(official.termStart)
    setTermEnd(official.termEnd)
    setFormOpen(true)
  }

  function saveOfficial() {
    if (!name.trim()) return
    if (editingOfficial) {
      setOfficials((current) => current.map((official) =>
        official.id === editingOfficial.id
          ? { ...official, name: name.trim(), position, termStart, termEnd, elected: isElectedPosition(position) }
          : official,
      ))
    } else {
      setOfficials((current) => [
        ...current,
        {
          id: `OFF-${String(current.length + 1).padStart(3, "0")}`,
          name: name.trim(),
          position,
          termStart,
          termEnd,
          status: "Current",
          elected: isElectedPosition(position),
        },
      ])
    }
    setFormOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Officials</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Maintain the list of barangay officials and their terms.
          </p>
        </div>
        <Button onClick={openAddForm}>
          <UserRoundPlus aria-hidden="true" />
          Add Official
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand/10 p-2.5 text-brand">
              <UserRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">Officials List</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search officials and review their term status.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search officials</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or position" className={`${formControlClass} pl-9`} />
            </label>
            <label className="sm:w-44">
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "Current" | "Former" | "all")} className={formControlClass}>
                <option>Current</option>
                <option>Former</option>
                <option value="all">All statuses</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Name", "Position", "Term", "Status", "Actions"].map((label) => (
                  <th key={label} className={label === "Actions" ? "px-4 py-3 text-right font-medium sm:px-5" : "px-4 py-3 align-middle font-medium sm:px-5"}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {officialPagination.paginatedItems.map((official) => (
                <tr key={official.id} className={`transition-colors hover:bg-muted/30 ${official.status === "Former" ? "opacity-70" : ""}`}>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <p className="font-semibold">{official.name}</p>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">{official.position}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                    {formatTermDate(official.termStart)} – {formatTermDate(official.termEnd)}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Badge variant="outline" className={statusStyles[official.status]}>{official.status}</Badge>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <RowActions
                      name={official.name}
                      isAdmin
                      primary={official.status === "Current"
                        ? { label: "Edit", variant: "outline", onSelect: () => openEditForm(official) }
                        : { label: "View", variant: "outline", onSelect: () => setViewOfficial(official) }}
                      items={[
                        { label: "End term / mark as former", hidden: official.status !== "Current", destructive: true, onSelect: () => { setTermEndDate(official.termEnd); setEndTermOfficial(official) } },
                        { label: "Reinstate", hidden: official.status !== "Former", onSelect: () => setOfficials((current) => current.map((item) => item.id === official.id ? { ...item, status: "Current" } : item)) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOfficials.length === 0 ? <EmptyState title="No matching officials" description="Try a different name, position, or status." /> : null}
        </div>
        <TablePagination start={officialPagination.start} end={officialPagination.end} total={officialPagination.total} pageIndex={officialPagination.pageIndex} pageCount={officialPagination.pageCount} onPageChange={officialPagination.setPageIndex} />
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOfficial ? "Edit Official" : "Add Official"}</DialogTitle>
            <DialogDescription>Maintain the official name, position, and term dates.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} className={formControlClass} required />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Position
              <select value={position} onChange={(event) => setPosition(event.target.value)} className={formControlClass}>
                {["Punong Barangay", "Barangay Kagawad", "SK Chairperson", "OIC Kagawad", "Barangay Secretary", "Barangay Treasurer", "Barangay Clerk", "Administrative Assistant"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Term start
              <input type="date" value={termStart} onChange={(event) => setTermStart(event.target.value)} className={formControlClass} required />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Term end
              <input type="date" value={termEnd} onChange={(event) => setTermEnd(event.target.value)} className={formControlClass} required />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!name.trim() || !termStart || !termEnd} onClick={saveOfficial}>{editingOfficial ? "Save changes" : "Add Official"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={endTermOfficial !== null} onOpenChange={(open) => { if (!open) setEndTermOfficial(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End official term?</DialogTitle>
            <DialogDescription>{endTermOfficial ? `Mark ${endTermOfficial.name} as a former official. The record will remain for history.` : "Confirm the end of this official term."}</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Term end date
            <input type="date" value={termEndDate} onChange={(event) => setTermEndDate(event.target.value)} className={formControlClass} required />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEndTermOfficial(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={!termEndDate} onClick={() => {
              if (!endTermOfficial) return
              setOfficials((current) => current.map((item) => item.id === endTermOfficial.id ? { ...item, termEnd: termEndDate, status: "Former" } : item))
              setEndTermOfficial(null)
            }}>End term</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOfficial !== null} onOpenChange={(open) => { if (!open) setViewOfficial(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Official details</DialogTitle>
            <DialogDescription>Historical reference for this official.</DialogDescription>
          </DialogHeader>
          {viewOfficial ? (
            <div className="grid gap-3 text-sm">
              <p><span className="text-muted-foreground">Name: </span>{viewOfficial.name}</p>
              <p><span className="text-muted-foreground">Position: </span>{viewOfficial.position}</p>
              <p><span className="text-muted-foreground">Term: </span>{formatTermDate(viewOfficial.termStart)} – {formatTermDate(viewOfficial.termEnd)}</p>
              <Badge variant="outline" className={statusStyles[viewOfficial.status]}>{viewOfficial.status}</Badge>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewOfficial(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
