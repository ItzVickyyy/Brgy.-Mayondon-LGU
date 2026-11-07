import { createFileRoute } from "@tanstack/react-router"
import type { ParseKeys, TFunction } from "i18next"
import {
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { EmptyState } from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { NoPermission } from "@/components/Common/NoPermission"
import { RowActions } from "@/components/Common/RowActions"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  TablePagination,
  usePagination,
} from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export const Route = createFileRoute("/_layout/backup-restore")({
  component: BackupRestore,
  head: () => ({ meta: [{ title: pageTitle("Backup and Restore") }] }),
})

type BackupStatus = "Verified" | "Not checked" | "Failed"

type BackupRecord = {
  name: string
  createdAt: string
  date: string
  type: "Scheduled" | "Manual"
  createdBy?: string
  size: string
  location: "External drive" | "This computer only"
  status: BackupStatus
  failureReason?: string
}

const sampleBackups: BackupRecord[] = []

const columnIds = [
  "backup",
  "created",
  "type",
  "size",
  "location",
  "check",
  "actions",
] as const

// Stored values stay English; these maps give the label that is shown.
const typeKeys = {
  Scheduled: "admin.backup.types.Scheduled",
  Manual: "admin.backup.types.Manual",
} as const satisfies Record<BackupRecord["type"], ParseKeys>

const locationKeys = {
  "External drive": "admin.backup.locations.External drive",
  "This computer only": "admin.backup.locations.This computer only",
} as const satisfies Record<BackupRecord["location"], ParseKeys>

const statusKeys = {
  Verified: "admin.backup.statuses.Verified",
  "Not checked": "admin.backup.statuses.Not checked",
  Failed: "admin.backup.statuses.Failed",
} as const satisfies Record<BackupStatus, ParseKeys>

function labelOf(keys: Record<string, ParseKeys>, value: string, t: TFunction) {
  const key = keys[value]
  return key ? t(key) : value
}

type Notice =
  | { key: "verify" | "copy" | "download"; name: string }
  | { key: "restoreConfirmed"; name?: undefined }

// The word the person must type; it is compared in code, so it is never translated.
const RESTORE_WORD = "RESTORE"

function BackupRestore() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [notice, setNotice] = useState<Notice | null>(null)
  const backups = sampleBackups
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState("")
  const [restoreConfirmation, setRestoreConfirmation] = useState("")

  const sortedBackups = [...backups].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const backupPagination = usePagination(sortedBackups, 10, backups.length)
  const latestBackup = sortedBackups[0]
  const daysSinceLatest = latestBackup
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(latestBackup.createdAt).getTime()) / 86400000,
        ),
      )
    : null

  if (!isSystemAdministrator(user)) return <NoPermission />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.backup.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("admin.backup.subtitle")}
          </p>
        </div>
      </div>

      <div
        role="status"
        className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <p className="font-medium">{t("admin.backup.unavailable.title")}</p>
        <p className="mt-1">
          <Trans
            i18nKey="admin.backup.unavailable.howTo"
            values={{
              command: ".\\scripts\\backup-db.ps1",
              folder: "backups",
            }}
            components={{ code: <code className="font-mono" /> }}
          />
        </p>
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-brand"
            aria-hidden="true"
          />
          <p className="flex-1">
            {t(`admin.backup.notices.${notice.key}`, { name: notice.name })}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => setNotice(null)}
            aria-label={t("admin.backup.dismiss")}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand/10 p-2.5">
              <DatabaseBackup className="size-5 text-brand" />
            </div>
            <div>
              <h2 className="font-semibold">
                {t("admin.backup.create.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.backup.create.subtitle")}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {t("admin.backup.create.destination")}
              </span>
              <span className="text-right font-medium">
                {t("admin.backup.create.destinationValue")}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {t("admin.backup.create.format")}
              </span>
              <span className="font-medium">
                {t("admin.backup.create.formatValue")}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {t("admin.backup.create.last")}
              </span>
              <span className="font-medium">
                {latestBackup?.date ?? t("admin.backup.create.lastNone")}
              </span>
            </div>
          </div>
          <Button
            className="mt-5 min-h-11 w-full"
            disabled
            title={t("admin.backup.notAvailableTitle")}
          >
            <HardDriveDownload aria-hidden="true" />
            {t("admin.backup.create.button")}
          </Button>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand/10 p-2.5">
              <Clock3 className="size-5 text-brand" />
            </div>
            <div>
              <h2 className="font-semibold">
                {t("admin.backup.schedule.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.backup.schedule.subtitle")}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("admin.backup.schedule.automatic")}</span>
              <select className={formControlClass} defaultValue="daily">
                <option value="disabled">
                  {t("admin.backup.schedule.disabled")}
                </option>
                <option value="daily">
                  {t("admin.backup.schedule.daily")}
                </option>
                <option value="weekly">
                  {t("admin.backup.schedule.weekly")}
                </option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("admin.backup.schedule.time")}</span>
              <input
                type="time"
                defaultValue="17:00"
                className={`${formControlClass} max-w-40`}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("admin.backup.schedule.keep")}</span>
              <select
                className={`${formControlClass} max-w-40`}
                defaultValue="7"
              >
                <option value="3">
                  {t("admin.backup.schedule.copies", { n: 3 })}
                </option>
                <option value="7">
                  {t("admin.backup.schedule.copies", { n: 7 })}
                </option>
                <option value="14">
                  {t("admin.backup.schedule.copies", { n: 14 })}
                </option>
                <option value="30">
                  {t("admin.backup.schedule.copies", { n: 30 })}
                </option>
              </select>
            </label>
          </div>
          <Button
            variant="outline"
            className="mt-5 w-full"
            disabled
            title={t("admin.backup.notAvailableTitle")}
          >
            {t("admin.backup.schedule.save")}
          </Button>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold tracking-tight">
              {t("admin.backup.history.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.backup.history.description")}
            </p>
          </div>
          {latestBackup && daysSinceLatest !== null ? (
            <Badge
              variant="outline"
              className={
                (daysSinceLatest ?? 0) > 1
                  ? statusStyles["Expiring soon"]
                  : statusStyles.Verified
              }
            >
              {daysSinceLatest === 0
                ? t("admin.backup.history.lastToday")
                : t("admin.backup.history.lastAgo", { count: daysSinceLatest })}
            </Badge>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columnIds.map((id) => (
                  <th
                    key={id}
                    className={
                      id === "actions"
                        ? "px-4 py-3 text-right font-medium sm:px-5"
                        : "px-4 py-3 align-middle font-medium sm:px-5"
                    }
                  >
                    {t(`admin.backup.history.columns.${id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {backupPagination.paginatedItems.map((backup) => (
                <tr
                  key={backup.name}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <span className="font-mono font-medium">{backup.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                    {backup.date}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <p>{labelOf(typeKeys, backup.type, t)}</p>
                    {backup.createdBy ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("admin.backup.history.by", {
                          name: backup.createdBy,
                        })}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                    {backup.size}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    {labelOf(locationKeys, backup.location, t)}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        variant="outline"
                        className={statusStyles[backup.status]}
                      >
                        {backup.status === "Verified" ? (
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                        ) : null}
                        {labelOf(statusKeys, backup.status, t)}
                      </Badge>
                      {backup.failureReason ? (
                        <span className="max-w-52 text-xs text-muted-foreground">
                          {backup.failureReason}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <RowActions
                      name={backup.name}
                      isAdmin
                      primary={
                        backup.status === "Verified"
                          ? {
                              label: t("admin.backup.actions.restore"),
                              variant: "outline",
                              icon: <RotateCcw aria-hidden="true" />,
                              onSelect: () => {
                                setSelectedBackup(backup.name)
                                setRestoreConfirmation("")
                                setConfirmRestore(true)
                              },
                            }
                          : undefined
                      }
                      items={[
                        {
                          label: t("admin.backup.actions.verify"),
                          hidden: backup.status === "Verified",
                          onSelect: () =>
                            setNotice({ key: "verify", name: backup.name }),
                        },
                        {
                          label: t("admin.backup.actions.copy"),
                          hidden: backup.location !== "This computer only",
                          onSelect: () =>
                            setNotice({ key: "copy", name: backup.name }),
                        },
                        {
                          label: t("admin.backup.actions.download"),
                          adminOnly: true,
                          onSelect: () =>
                            setNotice({ key: "download", name: backup.name }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedBackups.length === 0 ? (
            <EmptyState
              title={t("admin.backup.history.empty.title")}
              description={t("admin.backup.history.empty.description")}
            />
          ) : null}
        </div>
        <TablePagination
          start={backupPagination.start}
          end={backupPagination.end}
          total={backupPagination.total}
          pageIndex={backupPagination.pageIndex}
          pageCount={backupPagination.pageCount}
          onPageChange={backupPagination.setPageIndex}
        />
      </section>

      <section className="rounded-xl border border-destructive/30 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2.5">
            <RotateCcw className="size-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold">{t("admin.backup.restore.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.backup.restore.description")}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium">
            {t("admin.backup.restore.archive")}
            <select
              value={selectedBackup}
              disabled={sortedBackups.length === 0}
              onChange={(event) => {
                setSelectedBackup(event.target.value)
                setConfirmRestore(false)
                setRestoreConfirmation("")
              }}
              className={`${formControlClass} font-normal`}
            >
              {backups
                .filter((backup) => backup.status === "Verified")
                .map((backup) => (
                  <option key={backup.name} value={backup.name}>
                    {backup.name}
                  </option>
                ))}
            </select>
          </label>
          <Button
            variant="outline"
            className="min-h-11 border-destructive/50 text-destructive hover:bg-destructive/5"
            disabled={sortedBackups.length === 0}
            onClick={() => setConfirmRestore((value) => !value)}
          >
            <RotateCcw aria-hidden="true" />
            {confirmRestore
              ? t("admin.backup.restore.cancel")
              : t("admin.backup.restore.prepare")}
          </Button>
        </div>
        {confirmRestore ? (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="font-semibold">
              {t("admin.backup.restore.confirmTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              <Trans
                i18nKey="admin.backup.restore.confirmDescription"
                values={{ word: RESTORE_WORD }}
                components={{ strong: <strong className="text-foreground" /> }}
              />
            </p>
            <p className="mt-3 rounded-md bg-background p-3 font-mono text-sm">
              {selectedBackup}
            </p>
            <label className="mt-4 block text-sm font-medium">
              {t("admin.backup.restore.typeLabel", { word: RESTORE_WORD })}
              <input
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                placeholder={RESTORE_WORD}
                autoComplete="off"
                className={`${formControlClass} mt-2 sm:max-w-xs`}
              />
            </label>
            <Button
              variant="destructive"
              className="mt-4 min-h-11"
              disabled={
                !selectedBackup ||
                !sortedBackups.some(
                  (backup) => backup.name === selectedBackup,
                ) ||
                restoreConfirmation !== RESTORE_WORD
              }
              onClick={() => {
                setNotice({ key: "restoreConfirmed" })
                setConfirmRestore(false)
                setRestoreConfirmation("")
              }}
            >
              <ShieldCheck aria-hidden="true" />
              {t("admin.backup.restore.confirmButton")}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
