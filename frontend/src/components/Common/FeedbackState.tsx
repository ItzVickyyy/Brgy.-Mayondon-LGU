import { AlertCircle, Inbox, RotateCw } from "lucide-react"
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
  // Number of placeholder rows; 0 shows nothing but the screen-reader text.
  lines?: number
}

const skeletonWidths = ["w-2/3", "w-1/2", "w-3/5", "w-2/5"]

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

// Skeleton rows that look like the list or table they stand in for. The words
// stay for screen readers only; sighted people see the shape of the page.
export function LoadingState({ title, lines = 5 }: LoadingStateProps) {
  const { t } = useTranslation()
  return (
    <div className="w-full" role="status" aria-busy="true">
      <span className="sr-only">{title ?? t("common.feedback.loading")}</span>
      {lines > 0 ? (
        <div className="divide-y" aria-hidden="true">
          {Array.from({ length: lines }, (_, index) => (
            <div
              // The rows are identical placeholders; their order never changes.
              key={index}
              className="flex items-center gap-4 px-4 py-3.5"
            >
              <Skeleton className="size-9 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton
                  className={`h-3.5 ${skeletonWidths[index % skeletonWidths.length]}`}
                />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="hidden h-6 w-20 shrink-0 sm:block" />
            </div>
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
