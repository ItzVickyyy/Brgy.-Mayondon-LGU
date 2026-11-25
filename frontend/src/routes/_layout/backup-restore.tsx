import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ParseKeys, TFunction } from "i18next"
import {
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Download,
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { type BackupRunPublic, BackupsService, LoginService } from "@/client"
import {
  ConfirmPasswordDialog,
  type ConfirmScope,
  confirmHeaders,
  messageOf,
} from "@/components/Common/ConfirmPasswordDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { NoPermission } from "@/components/Common/NoPermission"
import { RowActions } from "@/components/Common/RowActions"
import {
  PageCheckbox,
  RowCheckbox,
  SelectionBar,
  selectCol,
} from "@/components/Common/SelectionControls"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  TablePagination,
  usePagination,
} from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PasswordInput } from "@/components/ui/password-input"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { isSystemAdministrator } from "@/lib/access"
import { formatLocaleDate, formatLocaleNumber } from "@/lib/locale"
import { notify } from "@/lib/notifications"
import { useRowSelection } from "@/lib/useRowSelection"
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

// A failed password check, told apart from a failed restore request.
class PasswordCheckError extends Error {}

function BackupRestore() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showErrorToast, showSuccessToast } = useCustomToast()
  const admin = isSystemAdministrator(user)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState("")
  const [restoreConfirmation, setRestoreConfirmation] = useState("")
  // The password is typed in the restore pop-up itself (one step, not two).
  const [restorePassword, setRestorePassword] = useState("")
  const [restorePasswordError, setRestorePasswordError] = useState("")
  // The password box for the other risky action (Download copy).
  const [asking, setAsking] = useState<{
    scope: ConfirmScope
    run: (token: string) => void
  } | null>(null)
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
      if (run.status === "ok" && !run.error)
        notice("verified", run.file_name ?? "")
      else
        showErrorToast(
          run.error
            ? `${t("admin.backup.failures.verify")} ${run.error}`
            : t("admin.backup.failures.verify"),
        )
    },
    onError: (err: Error) => handleError.call(showErrorToast, err),
    onSettled: refresh,
  })
  function closeRestore() {
    setConfirmRestore(false)
    setRestoreConfirmation("")
    setRestorePassword("")
    setRestorePasswordError("")
  }
  // One click: check the password (a wrong one stays in the pop-up as a
  // message and keeps the typed word), then record the restore request.
  const restoreMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      let token: string
      try {
        token = (
          await LoginService.confirmPassword({
            body: { password, scope: "backup.restore" },
          })
        ).data.confirm_token
      } catch (err) {
        throw new PasswordCheckError(
          messageOf(err, t("common.confirmPassword.failed")),
        )
      }
      return (
        await BackupsService.requestRestore({
          path: { backup_id: id },
          headers: confirmHeaders(token),
        })
      ).data
    },
    onSuccess: (result) => {
      setRestoreCommand({ name: result.file_name, command: result.command })
      notice("restoreChecked", result.file_name)
      closeRestore()
    },
    onError: (err: Error) => {
      setRestorePassword("")
      if (err instanceof PasswordCheckError)
        setRestorePasswordError(err.message)
      else handleError.call(showErrorToast, err)
    },
    onSettled: refresh,
  })

  async function download(run: BackupRunPublic, token: string) {
    try {
      const response = await BackupsService.downloadBackup({
        path: { backup_id: run.id },
        headers: confirmHeaders(token),
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
  const restoreReady =
    restorable.some((backup) => backup.id === selectedBackup) &&
    restoreConfirmation === RESTORE_WORD &&
    restorePassword !== "" &&
    !restoreMutation.isPending
  function submitRestore() {
    setRestorePasswordError("")
    restoreMutation.mutate({ id: selectedBackup, password: restorePassword })
  }
  const backupPagination = usePagination(
    sortedBackups,
    10,
    listQuery.data?.count ?? 0,
  )
  const pickBackups = useRowSelection(
    backupPagination.paginatedItems,
    (run) => String(run.id),
    sortedBackups.map((run) => String(run.id)),
  )
  // Verify selected: one file at a time (each check reads the whole archive).
  const verifiable = pickBackups
    .pick(backups)
    .filter((run) => run.status === "ok" && run.file_exists)
  const verifyAll = useMutation({
    mutationFn: async () => {
      let good = 0
      for (const run of verifiable) {
        const result = (
          await BackupsService.verifyBackup({ path: { backup_id: run.id } })
        ).data
        if (result.status === "ok" && !result.error) good += 1
      }
      return { good, total: verifiable.length }
    },
    onSuccess: ({ good, total }) => {
      if (good === total)
        showSuccessToast(
          t("admin.backup.notices.verifiedMany", { count: good }),
        )
      else showErrorToast(t("admin.backup.failures.verify"))
    },
    onError: (err: Error) => handleError.call(showErrorToast, err),
    onSettled: refresh,
  })
  const okRuns = backups.filter((run) => run.status === "ok")
  const latestGood = okRuns.find((run) => run.file_exists)
  // Backups are listed as made, but not one of them has its file in the folder.
  const allFilesGone =
    okRuns.length > 0 && !okRuns.some((run) => run.file_exists)
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
          <h1 className="page-title relative mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.backup.title")}
          </h1>
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

      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm sm:p-5">
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
            className="mt-auto min-h-11 w-full"
            disabled={!toolAvailable || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <HardDriveDownload aria-hidden="true" />
            {createMutation.isPending
              ? t("admin.backup.create.working")
              : t("admin.backup.create.button")}
          </Button>
        </section>

        <section className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm sm:p-5">
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

        <section
          data-testid="restore-card"
          className="flex h-full flex-col rounded-xl border border-destructive/30 bg-card p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-destructive/10 p-2.5">
              <RotateCcw className="size-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-semibold">
                {t("admin.backup.restore.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.backup.restore.description")}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <p
              id="backup-restore-archive-label"
              className="text-sm font-medium"
            >
              {t("admin.backup.restore.archive")}
            </p>
            {restorable.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {t("admin.backup.restore.none")}
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="backup-restore-archive-label"
                className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border bg-background p-1.5"
              >
                {restorable.map((backup) => {
                  const picked = selectedBackup === backup.id
                  return (
                    <label
                      key={backup.id}
                      data-testid="restore-file"
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                        picked
                          ? "border-destructive/50 bg-destructive/5"
                          : "border-transparent hover:bg-accent/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="backup-restore-archive"
                        value={backup.id}
                        checked={picked}
                        onChange={() => setSelectedBackup(backup.id)}
                        className="size-4 shrink-0 accent-[var(--destructive)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs sm:text-sm">
                          {backup.file_name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatMoment(backup.started_at)} ·{" "}
                          {formatSize(backup.size_bytes)}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="mt-4 min-h-11 w-full border-destructive/50 text-destructive hover:bg-destructive/5"
            disabled={!selectedBackup}
            onClick={() => {
              closeRestore()
              setConfirmRestore(true)
            }}
          >
            <RotateCcw aria-hidden="true" />
            {t("admin.backup.restore.prepare")}
          </Button>
        </section>
      </div>

      <Dialog
        open={confirmRestore}
        onOpenChange={(next) => {
          if (!next) closeRestore()
        }}
      >
        <DialogContent
          className={`${modalShell} sm:max-w-md`}
          data-testid="restore-confirm-dialog"
        >
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              if (restoreReady) submitRestore()
            }}
          >
            <DialogHeader className={modalHeader}>
              <div className="flex items-center gap-3 text-left">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                >
                  <RotateCcw className="size-5" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <DialogTitle className="text-lg leading-tight">
                    {t("admin.backup.restore.confirmTitle")}
                  </DialogTitle>
                  <DialogDescription className="text-xs leading-5 sm:text-sm">
                    <Trans
                      i18nKey="admin.backup.restore.confirmDescription"
                      values={{ word: RESTORE_WORD }}
                      components={{
                        strong: <strong className="text-foreground" />,
                      }}
                    />
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className={`${modalBody} grid gap-4`}>
              <p
                data-testid="restore-confirm-file"
                className="break-all rounded-md bg-muted/50 p-3 font-mono text-sm"
              >
                {backups.find((run) => run.id === selectedBackup)?.file_name}
              </p>
              <label className="block text-sm font-medium">
                {t("admin.backup.restore.typeLabel", { word: RESTORE_WORD })}
                <input
                  value={restoreConfirmation}
                  onChange={(event) =>
                    setRestoreConfirmation(event.target.value)
                  }
                  placeholder={RESTORE_WORD}
                  autoComplete="off"
                  autoFocus
                  className={`${formControlClass} mt-2`}
                />
              </label>
              <div className="grid gap-2">
                <label
                  htmlFor="restore-password"
                  className="text-sm font-medium"
                >
                  {t("common.confirmPassword.label")}
                </label>
                <PasswordInput
                  id="restore-password"
                  data-testid="restore-password"
                  autoComplete="current-password"
                  value={restorePassword}
                  error={restorePasswordError}
                  onChange={(event) => {
                    setRestorePassword(event.target.value)
                    setRestorePasswordError("")
                  }}
                />
                <p
                  role="alert"
                  data-testid="restore-password-error"
                  className="min-h-5 text-sm text-destructive"
                >
                  {restorePasswordError}
                </p>
              </div>
            </div>
            <div
              className={`${modalFooter} flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`}
            >
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                data-testid="restore-confirm-cancel"
                onClick={closeRestore}
              >
                {t("admin.backup.restore.cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="min-h-11"
                disabled={!restoreReady}
              >
                <ShieldCheck aria-hidden="true" />
                {t("admin.backup.restore.confirmButton")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {allFilesGone ? (
        <div
          role="alert"
          data-testid="backup-files-missing"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold">
            {t("admin.backup.filesMissing.title")}
          </p>
          <p className="mt-1 leading-6 text-muted-foreground">
            {t("admin.backup.filesMissing.text")}
          </p>
        </div>
      ) : null}
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
        <SelectionBar
          count={pickBackups.count}
          onClear={pickBackups.clear}
          csvName="backups-selected.csv"
          csvRows={() => [
            columnIds
              .filter((id) => id !== "actions")
              .map((id) => t(`admin.backup.history.columns.${id}`)),
            ...pickBackups
              .pick(sortedBackups)
              .map((run) => [
                run.file_name ?? "—",
                formatMoment(run.started_at),
                labelOf(typeKeys, run.kind, t),
                formatSize(run.size_bytes),
                labelOf(statusKeys, statusOf(run), t),
              ]),
          ]}
        >
          <Button
            type="button"
            variant="tintTeal"
            size="sm"
            data-testid="verify-selected"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={verifiable.length === 0 || verifyAll.isPending}
            onClick={() => verifyAll.mutate()}
          >
            <ShieldCheck aria-hidden="true" />
            {t("admin.backup.actions.verifySelected")}
          </Button>
        </SelectionBar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className={selectCol}>
                  <PageCheckbox
                    all={pickBackups.allOnPage}
                    some={pickBackups.someOnPage}
                    onChange={pickBackups.togglePage}
                  />
                </th>
                {columnIds.map((id) => (
                  <th
                    key={id}
                    className={
                      id === "actions"
                        ? "sticky right-0 bg-muted sticky-head-cell px-4 py-3 text-center font-medium sm:px-5"
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
                    <td className={selectCol}>
                      <RowCheckbox
                        label={name}
                        checked={pickBackups.isSelected(String(backup.id))}
                        onChange={() => pickBackups.toggle(String(backup.id))}
                      />
                    </td>
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
                                variant: "tintGreen",
                                icon: <RotateCcw aria-hidden="true" />,
                                onSelect: () => {
                                  setSelectedBackup(backup.id)
                                  closeRestore()
                                  setConfirmRestore(true)
                                },
                              }
                            : undefined
                        }
                        actions={[
                          ...(backup.status === "ok" && backup.file_exists
                            ? [
                                {
                                  label: t("admin.backup.actions.verify"),
                                  variant: "tintTeal" as const,
                                  icon: <ShieldCheck aria-hidden="true" />,
                                  disabled: verifyMutation.isPending,
                                  onSelect: () =>
                                    verifyMutation.mutate(backup.id),
                                },
                              ]
                            : []),
                          ...(backup.status === "ok" && backup.file_exists
                            ? [
                                {
                                  label: t("admin.backup.actions.download"),
                                  variant: "tintViolet" as const,
                                  icon: <Download aria-hidden="true" />,
                                  onSelect: () =>
                                    setAsking({
                                      scope: "backup.download",
                                      run: (token) => download(backup, token),
                                    }),
                                },
                              ]
                            : []),
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

      <ConfirmPasswordDialog
        open={asking !== null}
        scope={asking?.scope ?? "backup.restore"}
        description={
          asking?.scope === "backup.download"
            ? t("common.confirmPassword.downloadDescription")
            : t("common.confirmPassword.restoreDescription")
        }
        onCancel={() => setAsking(null)}
        onConfirmed={(token) => {
          const next = asking
          setAsking(null)
          next?.run(token)
        }}
      />
    </div>
  )
}
