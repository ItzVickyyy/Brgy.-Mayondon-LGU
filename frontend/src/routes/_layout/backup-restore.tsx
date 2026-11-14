import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ParseKeys, TFunction } from "i18next"
import {
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { type BackupRunPublic, BackupsService } from "@/client"
import { EmptyState } from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { NoPermission } from "@/components/Common/NoPermission"
import { RowActions } from "@/components/Common/RowActions"
import { Select } from "@/components/Common/Select"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  TablePagination,
  usePagination,
} from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { isSystemAdministrator } from "@/lib/access"
import { formatLocaleDate, formatLocaleNumber } from "@/lib/locale"
import { notify } from "@/lib/notifications"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/backup-restore")({
  component: BackupRestore,
  head: () => ({ meta: [{ title: pageTitle("Backup and Restore") }] }),
})

type BackupStatus = "Verified" | "Not checked" | "Running" | "Failed"

const columnIds = [
  "backup",
  "created",
  "type",
  "size",
  "check",
  "actions",
] as const

// Stored values stay English; these maps give the label that is shown.
const typeKeys = {
  scheduled: "admin.backup.types.Scheduled",
  manual: "admin.backup.types.Manual",
} as const satisfies Record<string, ParseKeys>

const statusKeys = {
  Verified: "admin.backup.statuses.Verified",
  "Not checked": "admin.backup.statuses.Not checked",
  Running: "admin.backup.statuses.Running",
  Failed: "admin.backup.statuses.Failed",
} as const satisfies Record<BackupStatus, ParseKeys>

function labelOf(keys: Record<string, ParseKeys>, value: string, t: TFunction) {
  const key = keys[value]
  return key ? t(key) : value
}

function statusOf(run: BackupRunPublic): BackupStatus {
  if (run.status === "failed") return "Failed"
  if (run.status === "running") return "Running"
  return run.verified_at ? "Verified" : "Not checked"
}

function formatMoment(value: string) {
  return formatLocaleDate(new Date(value), {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  })
}

function formatSize(bytes: number | null) {
  if (bytes === null) return "—"
  const options = { maximumFractionDigits: 1 }
  if (bytes >= 1024 * 1024)
    return `${formatLocaleNumber(bytes / (1024 * 1024), options)} MB`
  return `${formatLocaleNumber(Math.max(1, bytes / 1024), options)} KB`
}

type NoticeKey = "created" | "verified" | "downloaded" | "restoreChecked"

function notice(key: NoticeKey, name: string) {
  notify({ key: `admin.backup.notices.${key}`, values: { name } })
}

// The word the person must type; it is compared in code, so it is never translated.
const RESTORE_WORD = "RESTORE"

function BackupRestore() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const admin = isSystemAdministrator(user)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState("")
  const [restoreConfirmation, setRestoreConfirmation] = useState("")
  const [restoreCommand, setRestoreCommand] = useState<{
    name: string
    command: string
  } | null>(null)

  const listQuery = useQuery({
    queryKey: ["backups"],
    queryFn: async () => (await BackupsService.listBackups()).data,
    enabled: admin,
  })
  const backups = listQuery.data?.data ?? []
  const toolAvailable = listQuery.data?.tool_available ?? true
  const keepCopies = listQuery.data?.keep_copies

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["backups"] })

  const createMutation = useMutation({
    mutationFn: async () => (await BackupsService.createBackup()).data,
    onSuccess: (run) => {
      if (run.status === "ok") notice("created", run.file_name ?? "")
      else showErrorToast(t("admin.backup.failures.create"))
    },
    onError: (err: Error) => handleError.call(showErrorToast, err),
    onSettled: refresh,
  })
  const verifyMutation = useMutation({
    mutationFn: async (id: string) =>
      (await BackupsService.verifyBackup({ path: { backup_id: id } })).data,
    onSuccess: (run) => {
      if (run.status === "ok") notice("verified", run.file_name ?? "")
      else showErrorToast(t("admin.backup.failures.verify"))
    },
    onError: (err: Error) => handleError.call(showErrorToast, err),
    onSettled: refresh,
  })
  const restoreMutation = useMutation({
    mutationFn: async (id: string) =>
      (await BackupsService.requestRestore({ path: { backup_id: id } })).data,
    onSuccess: (result) => {
      setRestoreCommand({ name: result.file_name, command: result.command })
      notice("restoreChecked", result.file_name)
      setConfirmRestore(false)
      setRestoreConfirmation("")
    },
    onError: (err: Error) => handleError.call(showErrorToast, err),
    onSettled: refresh,
  })

  async function download(run: BackupRunPublic) {
    try {
      const response = await BackupsService.downloadBackup({
        path: { backup_id: run.id },
        responseType: "blob",
      } as Parameters<typeof BackupsService.downloadBackup>[0])
      const url = URL.createObjectURL(response.data as unknown as Blob)
      const link = document.createElement("a")
      link.href = url
      link.download = run.file_name ?? "backup.dump"
      link.click()
      URL.revokeObjectURL(url)
      notice("downloaded", run.file_name ?? "")
    } catch (err) {
      handleError.call(showErrorToast, err as Error)
    }
  }

  const sortedBackups = backups
  const restorable = backups.filter(
    (run) => statusOf(run) === "Verified" && run.file_exists,
  )
  const backupPagination = usePagination(
    sortedBackups,
    10,
    listQuery.data?.count ?? 0,
  )
  const latestGood = backups.find((run) => run.status === "ok")
  const daysSinceLatest = latestGood
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(latestGood.started_at).getTime()) / 86400000,
        ),
      )
    : null

  if (!admin) return <NoPermission />

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

      {restoreCommand ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">
            {t("admin.backup.restore.readyTitle")}
          </p>
          <p className="mt-1 leading-6 text-muted-foreground">
            {t("admin.backup.restore.readyDescription", {
              name: restoreCommand.name,
            })}
          </p>
          <p className="mt-3 select-all break-all rounded-md bg-background p-3 font-mono text-sm">
            {restoreCommand.command}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setRestoreCommand(null)}
          >
            {t("admin.backup.dismiss")}
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
                {latestGood
                  ? formatMoment(latestGood.started_at)
                  : t("admin.backup.create.lastNone")}
              </span>
            </div>
          </div>
          <Button
            className="mt-5 min-h-11 w-full"
            disabled={!toolAvailable || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <HardDriveDownload aria-hidden="true" />
            {createMutation.isPending
              ? t("admin.backup.create.working")
              : t("admin.backup.create.button")}
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
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {t("admin.backup.schedule.keep")}
              </span>
              <span className="font-medium">
                {keepCopies !== undefined
                  ? t("admin.backup.schedule.copies", { n: keepCopies })
                  : "—"}
              </span>
            </div>
            <p className="leading-6 text-muted-foreground">
              {t("admin.backup.schedule.note")}
            </p>
          </div>
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
          {latestGood && daysSinceLatest !== null ? (
            <Badge
              variant="outline"
              className={
                daysSinceLatest > 1
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
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columnIds.map((id) => (
                  <th
                    key={id}
                    className={
                      id === "actions"
                        ? "sticky right-0 bg-muted sticky-head-cell px-4 py-3 text-right font-medium sm:px-5"
                        : "px-4 py-3 align-middle font-medium sm:px-5"
                    }
                  >
                    {t(`admin.backup.history.columns.${id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {backupPagination.paginatedItems.map((backup) => {
                const status = statusOf(backup)
                const name = backup.file_name ?? "—"
                return (
                  <tr
                    key={backup.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 align-middle sm:px-5">
                      <span className="font-mono font-medium">{name}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                      {formatMoment(backup.started_at)}
                    </td>
                    <td className="px-4 py-3 align-middle sm:px-5">
                      <p>{labelOf(typeKeys, backup.kind, t)}</p>
                      {backup.created_by_email ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("admin.backup.history.by", {
                            name: backup.created_by_email,
                          })}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5">
                      {formatSize(backup.size_bytes)}
                    </td>
                    <td className="px-4 py-3 align-middle sm:px-5">
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          variant="outline"
                          className={
                            statusStyles[
                              status === "Running" ? "Pending" : status
                            ]
                          }
                        >
                          {status === "Verified" ? (
                            <CheckCircle2
                              className="size-4"
                              aria-hidden="true"
                            />
                          ) : null}
                          {labelOf(statusKeys, status, t)}
                        </Badge>
                        {backup.status === "ok" && !backup.file_exists ? (
                          <span className="max-w-52 text-xs text-muted-foreground">
                            {t("admin.backup.history.fileGone")}
                          </span>
                        ) : null}
                        {backup.error ? (
                          <span className="max-w-52 text-xs text-muted-foreground">
                            {backup.error}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="sticky right-0 bg-card row-hover-cell px-4 py-3 align-middle sm:px-5 sticky-edge">
                      <RowActions
                        name={name}
                        isAdmin
                        primary={
                          status === "Verified" && backup.file_exists
                            ? {
                                label: t("admin.backup.actions.restore"),
                                variant: "outline",
                                icon: <RotateCcw aria-hidden="true" />,
                                onSelect: () => {
                                  setSelectedBackup(backup.id)
                                  setRestoreConfirmation("")
                                  setConfirmRestore(true)
                                },
                              }
                            : undefined
                        }
                        items={[
                          {
                            label: t("admin.backup.actions.verify"),
                            hidden: backup.status !== "ok",
                            disabled: verifyMutation.isPending,
                            onSelect: () => verifyMutation.mutate(backup.id),
                          },
                          {
                            label: t("admin.backup.actions.download"),
                            adminOnly: true,
                            hidden:
                              backup.status !== "ok" || !backup.file_exists,
                            onSelect: () => download(backup),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {listQuery.isSuccess && sortedBackups.length === 0 ? (
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
          pageSize={backupPagination.pageSize}
          onPageSizeChange={backupPagination.setPageSize}
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
          <label
            htmlFor="backup-restore-archive"
            className="flex flex-col gap-2 text-sm font-medium"
          >
            {t("admin.backup.restore.archive")}
            <Select
              id="backup-restore-archive"
              value={selectedBackup}
              disabled={restorable.length === 0}
              onChange={(event) => {
                setSelectedBackup(event.target.value)
                setConfirmRestore(false)
                setRestoreConfirmation("")
              }}
              className={`${formControlClass} font-normal`}
            >
              <option value="">{t("admin.backup.restore.choose")}</option>
              {restorable.map((backup) => (
                <option key={backup.id} value={backup.id}>
                  {backup.file_name}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="outline"
            className="min-h-11 border-destructive/50 text-destructive hover:bg-destructive/5"
            disabled={!selectedBackup && !confirmRestore}
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
              {backups.find((run) => run.id === selectedBackup)?.file_name}
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
                !restorable.some((backup) => backup.id === selectedBackup) ||
                restoreConfirmation !== RESTORE_WORD ||
                restoreMutation.isPending
              }
              onClick={() => restoreMutation.mutate(selectedBackup)}
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
