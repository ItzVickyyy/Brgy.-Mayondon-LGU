import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { SystemService } from "@/client"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { UPDATE_STATUS_KEY, useUpdateStatus } from "./useUpdateStatus"

type Phase = "confirm" | "running" | "done" | "failed"

// The computer picks a request up within seconds; if the version is still only "available" after
// this long, the update never started. A whole update takes 2 to 10 minutes.
const NOT_STARTED_MS = 150_000
const GIVE_UP_MS = 20 * 60_000

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The Update button of the notification bell: explains what happens, asks the computer to install
 * the approved version now, follows the update, and offers a reload when it is done. While the
 * program restarts (under a minute) the status cannot be read; that is shown as "reconnecting",
 * not as an error.
 */
export function UpdateDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const status = useUpdateStatus(open, true)
  const data = status.data
  const [phase, setPhase] = useState<Phase>("confirm")
  const [failure, setFailure] = useState("")
  const startedAt = useRef(0)
  const seenUpdating = useRef(false)

  useEffect(() => {
    if (!open) {
      setPhase("confirm")
      setFailure("")
      seenUpdating.current = false
    }
  }, [open])

  // Opened while an update is already on its way (another administrator pressed it, or the
  // night run is in progress): go straight to following it.
  useEffect(() => {
    if (open && phase === "confirm" && data) {
      if (data.state === "updating" || data.requested) {
        startedAt.current = Date.now()
        seenUpdating.current = data.state === "updating"
        setPhase("running")
      }
    }
  }, [open, phase, data])

  const request = useMutation({
    mutationFn: async () => (await SystemService.requestUpdate()).data,
    onSuccess: (next) => {
      queryClient.setQueryData(UPDATE_STATUS_KEY, next)
      startedAt.current = Date.now()
      seenUpdating.current = false
      setPhase("running")
    },
    onError: handleError.bind(showErrorToast),
  })

  // Follows the update. `dataUpdatedAt` moves on every poll, so the time limits are checked
  // even when the answer has not changed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per poll on purpose
  useEffect(() => {
    if (phase !== "running" || !data) return
    const elapsed = Date.now() - startedAt.current
    if (data.state === "updating") seenUpdating.current = true
    if (data.state === "up_to_date") {
      setPhase("done")
    } else if (data.state === "failed") {
      setFailure(data.message)
      setPhase("failed")
    } else if (data.state === "available" && !data.requested) {
      if (seenUpdating.current) {
        setFailure(t("update.dialog.didNotFinish"))
        setPhase("failed")
      } else if (elapsed > NOT_STARTED_MS) {
        setFailure(t("update.dialog.didNotStart"))
        setPhase("failed")
      }
    }
    if (elapsed > GIVE_UP_MS) {
      setFailure(t("update.dialog.tooLong"))
      setPhase("failed")
    }
  }, [phase, data, status.dataUpdatedAt, t])

  // The window cannot be closed while the program is being replaced.
  const locked = phase === "running"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && locked) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={`${modalShell} sm:max-w-md`}
        data-testid="update-dialog"
        data-phase={phase}
        onInteractOutside={(event) => {
          if (locked) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (locked) event.preventDefault()
        }}
      >
        <DialogHeader className={modalHeader}>
          <DialogTitle>{t(`update.dialog.title.${phase}`)}</DialogTitle>
          <DialogDescription>
            {t(`update.dialog.description.${phase}`)}
          </DialogDescription>
        </DialogHeader>
        <div className={`${modalBody} grid gap-3 text-sm`} aria-live="polite">
          {phase === "confirm" ? (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("update.dialog.points.backup")}</li>
              <li>{t("update.dialog.points.unavailable")}</li>
              <li>{t("update.dialog.points.safe")}</li>
            </ul>
          ) : null}
          {phase === "running" ? (
            <div className="flex items-start gap-3" role="status">
              <Loader2
                className="mt-0.5 size-5 shrink-0 animate-spin text-brand motion-reduce:animate-none"
                aria-hidden="true"
              />
              <div className="grid gap-1">
                <p className="font-medium">
                  {status.isError
                    ? t("update.dialog.reconnecting")
                    : data?.state === "updating"
                      ? t("update.dialog.updating")
                      : t("update.dialog.starting")}
                </p>
                <p className="text-muted-foreground">
                  {t("update.dialog.keepOpen")}
                </p>
              </div>
            </div>
          ) : null}
          {phase === "done" ? (
            <div className="flex items-start gap-3" role="status">
              <CircleCheck
                className="mt-0.5 size-5 shrink-0 text-green-700 dark:text-green-400"
                aria-hidden="true"
              />
              <p>{t("update.dialog.reload")}</p>
            </div>
          ) : null}
          {phase === "failed" ? (
            <div className="flex items-start gap-3" role="alert">
              <CircleAlert
                className="mt-0.5 size-5 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div className="grid gap-1">
                <p>{failure || t("update.dialog.failedGeneric")}</p>
                <p className="text-muted-foreground">
                  {t("update.dialog.failedSafe")}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <div
          className={`${modalFooter} flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`}
        >
          {phase === "confirm" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:min-h-9"
                onClick={() => onOpenChange(false)}
              >
                {t("update.dialog.cancel")}
              </Button>
              <LoadingButton
                type="button"
                data-testid="update-confirm"
                className="min-h-11 sm:min-h-9"
                loading={request.isPending}
                onClick={() => request.mutate()}
              >
                {t("update.dialog.confirm")}
              </LoadingButton>
            </>
          ) : null}
          {phase === "done" ? (
            <Button
              type="button"
              data-testid="update-reload"
              className="min-h-11 sm:min-h-9"
              onClick={() => window.location.reload()}
            >
              {t("update.dialog.reloadButton")}
            </Button>
          ) : null}
          {phase === "failed" ? (
            <Button
              type="button"
              data-testid="update-close"
              className="min-h-11 sm:min-h-9"
              onClick={() => onOpenChange(false)}
            >
              {t("update.dialog.close")}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
