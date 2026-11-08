import { AlertCircle, Inbox, LoaderCircle, RotateCw } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type EmptyStateProps = {
  title: string
  description?: string
  // Optional next step, for example a button that adds the first record.
  action?: ReactNode
}

type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

type LoadingStateProps = {
  title?: string
  // Placeholder rows shown under the message; 0 shows the message alone.
  lines?: number
}

const skeletonWidths = ["w-full", "w-5/6", "w-2/3", "w-3/4"]

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="animate-in fade-in-0 flex flex-col items-center justify-center gap-2 p-8 text-center duration-300">
      <div className="rounded-full bg-muted p-3">
        <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-1 text-base font-medium">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function LoadingState({ title, lines = 3 }: LoadingStateProps) {
  const { t } = useTranslation()
  return (
    <div
      className="flex min-h-24 flex-col items-center justify-center gap-4 p-6 text-base text-muted-foreground"
      role="status"
    >
      <div className="flex items-center gap-2">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        <span>{title ?? t("common.feedback.loading")}</span>
      </div>
      {lines > 0 ? (
        <div className="w-full max-w-md space-y-2.5" aria-hidden="true">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton
              // The rows are identical placeholders; their order never changes.
              key={index}
              className={`h-3.5 ${skeletonWidths[index % skeletonWidths.length]}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ErrorState({
  title,
  description,
  onRetry,
}: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div
      className="animate-in fade-in-0 flex flex-col items-center justify-center gap-2 p-8 text-center duration-300"
      role="alert"
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      </div>
      <p className="mt-1 text-base font-medium">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCw className="mr-2 size-4" aria-hidden="true" />
          {t("common.feedback.retry")}
        </Button>
      ) : null}
    </div>
  )
}
