import { createFileRoute } from "@tanstack/react-router"
import {
  Archive,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react"
import { useState } from "react"

import { NoPermission } from "@/components/Common/NoPermission"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export const Route = createFileRoute("/_layout/backup-restore")({
  component: BackupRestore,
  head: () => ({ meta: [{ title: pageTitle("Backup and Restore") }] }),
})

const sampleBackups = [
  {
    name: "mayondon-db-20261028-090000.dump",
    date: "Oct 28, 2026 · 9:00 AM",
    size: "4.8 MB",
    status: "Verified",
  },
  {
    name: "mayondon-db-20261027-170000.dump",
    date: "Oct 27, 2026 · 5:00 PM",
    size: "4.6 MB",
    status: "Verified",
  },
  {
    name: "mayondon-db-20261026-170000.dump",
    date: "Oct 26, 2026 · 5:00 PM",
    size: "4.5 MB",
    status: "Verified",
  },
]

function BackupRestore() {
  const { user } = useAuth()
  const [notice, setNotice] = useState("")
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState(sampleBackups[0].name)
  const [restoreConfirmation, setRestoreConfirmation] = useState("")

  if (!isSystemAdministrator(user)) return <NoPermission />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Backup and Restore
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Protect the barangay's local records and recover from data loss.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="icon" className="size-11" onClick={() => setNotice("")} aria-label="Dismiss message"><X aria-hidden="true" /></Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <DatabaseBackup className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Create a Backup</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manual database backup
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Destination</span>
              <span className="text-right font-medium">
                Local backup folder / external drive
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">File format</span>
              <span className="font-medium">
                PostgreSQL custom archive (.dump)
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last backup</span>
              <span className="font-medium">Oct 28, 2026 · 9:00 AM</span>
            </div>
          </div>
          <Button className="mt-5 min-h-11 w-full" onClick={() => setNotice("")}>
            <HardDriveDownload aria-hidden="true" />
            Create Backup
          </Button>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Clock3 className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Backup Schedule</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set a recurring backup schedule
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Automatic backup</span>
              <select
                className={formControlClass}
                defaultValue="daily"
              >
                <option value="disabled">Disabled</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Preferred time</span>
              <input
                type="time"
                defaultValue="17:00"
                className={`${formControlClass} max-w-40`}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Keep recent backups</span>
              <select
                className={`${formControlClass} max-w-40`}
                defaultValue="7"
              >
                <option value="3">3 copies</option>
                <option value="7">7 copies</option>
                <option value="14">14 copies</option>
                <option value="30">30 copies</option>
              </select>
            </label>
          </div>
          <Button variant="outline" className="mt-5 w-full" onClick={() => setNotice("")}>Save Schedule</Button>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Backup History</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review available backup archives.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Backup file</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Created</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Size</th>
                <th className="px-4 py-3 align-middle font-medium sm:px-5">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sampleBackups.map((backup) => (
                <tr key={backup.name} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Archive className="size-4 text-muted-foreground" />
                      {backup.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">{backup.date}</td>
                  <td className="px-4 py-3 align-middle text-muted-foreground sm:px-5">{backup.size}</td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Badge variant="outline" className={statusStyles[backup.status]}><CheckCircle2 className="size-4" aria-hidden="true" />{backup.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-destructive/30 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2.5">
            <RotateCcw className="size-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold">Restore a Backup</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Restoring can replace current database contents. Choose the
              archive and confirm only after verifying the target system and
              backup.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Backup archive
            <select
              value={selectedBackup}
              onChange={(event) => {
                setSelectedBackup(event.target.value)
                setConfirmRestore(false)
                setRestoreConfirmation("")
              }}
              className={`${formControlClass} font-normal`}
            >
              {sampleBackups.map((backup) => (
                <option key={backup.name} value={backup.name}>
                  {backup.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            className="min-h-11 border-destructive/50 text-destructive hover:bg-destructive/5"
            onClick={() => setConfirmRestore((value) => !value)}
          >
            <RotateCcw aria-hidden="true" />
            {confirmRestore ? "Cancel Restore" : "Prepare Restore"}
          </Button>
        </div>
        {confirmRestore ? (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="font-semibold">Confirm restore</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This action can replace the current database. Verify the selected
              archive and type{" "}
              <strong className="text-foreground">RESTORE</strong> to confirm.
            </p>
            <p className="mt-3 rounded-md bg-background p-3 font-mono text-sm">
              {selectedBackup}
            </p>
            <label className="mt-4 block text-sm font-medium">
              Type RESTORE to continue
              <input
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                placeholder="RESTORE"
                autoComplete="off"
                className={`${formControlClass} mt-2 sm:max-w-xs`}
              />
            </label>
            <Button
              variant="destructive"
              className="mt-4 min-h-11"
              disabled={restoreConfirmation !== "RESTORE"}
              onClick={() => {
                setNotice("Restore request confirmed.")
                setConfirmRestore(false)
                setRestoreConfirmation("")
              }}
            >
              <ShieldCheck aria-hidden="true" />
              Confirm Restore
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
