import { createFileRoute, redirect } from "@tanstack/react-router"
import { Archive, CheckCircle2, Clock3, DatabaseBackup, HardDriveDownload, History, RotateCcw, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { UsersService } from "@/client"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/backup-restore")({
  component: BackupRestore,
  beforeLoad: async () => {
    const { data: user } = await UsersService.readUserMe()
    if (!user.is_superuser) throw redirect({ to: "/" })
  },
  head: () => ({ meta: [{ title: pageTitle("Backup and Restore") }] }),
})

const sampleBackups = [
  { name: "mayondon-db-20261028-090000.dump", date: "Oct 28, 2026 · 9:00 AM", size: "4.8 MB", status: "Verified" },
  { name: "mayondon-db-20261027-170000.dump", date: "Oct 27, 2026 · 5:00 PM", size: "4.6 MB", status: "Verified" },
  { name: "mayondon-db-20261026-170000.dump", date: "Oct 26, 2026 · 5:00 PM", size: "4.5 MB", status: "Verified" },
]

function BackupRestore() {
  const [notice, setNotice] = useState("")
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState(sampleBackups[0].name)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Administration</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Backup and Restore</h1>
        <p className="mt-2 text-sm text-muted-foreground">Protect the barangay's local records and recover from data loss.</p>
      </div>

      {notice ? <div role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><DatabaseBackup className="size-5 text-primary" /></div>
            <div><h2 className="font-semibold">Create a Backup</h2><p className="text-sm text-muted-foreground">Manual database backup</p></div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Destination</span><span className="text-right font-medium">Local backup folder / external drive</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">File format</span><span className="font-medium">PostgreSQL custom archive (.dump)</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Last backup</span><span className="font-medium">Oct 28, 2026 · 9:00 AM</span></div>
          </div>
          <button type="button" onClick={() => setNotice("")} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"><HardDriveDownload className="size-4" />Create Backup</button>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Clock3 className="size-5 text-primary" /></div>
            <div><h2 className="font-semibold">Backup Schedule</h2><p className="text-sm text-muted-foreground">Set a recurring backup schedule</p></div>
          </div>
          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm"><span>Automatic backup</span><select className="h-9 rounded-md border bg-background px-2" defaultValue="daily"><option value="disabled">Disabled</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Preferred time</span><input type="time" defaultValue="17:00" className="h-9 rounded-md border bg-background px-2" /></label>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Keep recent backups</span><select className="h-9 rounded-md border bg-background px-2" defaultValue="7"><option value="3">3 copies</option><option value="7">7 copies</option><option value="14">14 copies</option><option value="30">30 copies</option></select></label>
          </div>
          <button type="button" onClick={() => setNotice("")} className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted">Save Schedule</button>
        </section>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div><h2 className="font-semibold">Backup History</h2><p className="mt-1 text-sm text-muted-foreground">Review available backup archives.</p></div>
          
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Backup file</th><th className="px-5 py-3 font-medium">Created</th><th className="px-5 py-3 font-medium">Size</th><th className="px-5 py-3 font-medium">Validation</th></tr></thead>
            <tbody>{sampleBackups.map((backup) => <tr key={backup.name} className="border-t"><td className="px-5 py-3"><span className="inline-flex items-center gap-2"><Archive className="size-4 text-muted-foreground" />{backup.name}</span></td><td className="px-5 py-3">{backup.date}</td><td className="px-5 py-3">{backup.size}</td><td className="px-5 py-3"><span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" />{backup.status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-destructive/30 bg-card p-5">
        <div className="flex items-start gap-3"><div className="rounded-lg bg-destructive/10 p-2.5"><RotateCcw className="size-5 text-destructive" /></div><div><h2 className="font-semibold">Restore a Backup</h2><p className="mt-1 text-sm text-muted-foreground">Restoring can replace current database contents. Choose the archive and confirm only after verifying the target system and backup.</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium">Backup archive<select value={selectedBackup} onChange={(event) => { setSelectedBackup(event.target.value); setConfirmRestore(false) }} className="h-10 rounded-md border bg-background px-3 font-normal">{sampleBackups.map((backup) => <option key={backup.name} value={backup.name}>{backup.name}</option>)}</select></label>
          <button type="button" onClick={() => setConfirmRestore((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive/50 px-4 text-sm font-medium text-destructive hover:bg-destructive/5"><RotateCcw className="size-4" />{confirmRestore ? "Cancel Restore" : "Prepare Restore"}</button>
        </div>
        {confirmRestore ? <div className="mt-4 rounded-lg border border-destructive/40 p-4"><p className="font-medium">Confirm restore preparation</p><p className="mt-1 text-sm text-muted-foreground">Selected archive: {selectedBackup}.</p><p className="mt-3 text-sm">Selected backup: {selectedBackup}</p><button type="button" onClick={() => setNotice("")} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"><ShieldCheck className="size-4" />Confirm Restore</button></div> : null}
      </section>
      
    </div>
  )
}
