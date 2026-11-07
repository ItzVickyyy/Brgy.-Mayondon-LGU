import { AlertCircle, Inbox, LoaderCircle, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

type EmptyStateProps = {
  title: string
  description?: string
}

type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-medium">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export function LoadingState({ title }: { title?: string }) {
  const { t } = useTranslation()
  return (
    <div
      className="flex min-h-24 items-center justify-center gap-2 p-6 text-base text-muted-foreground"
      role="status"
    >
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span>{title ?? t("common.feedback.loading")}</span>
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
      className="flex flex-col items-center justify-center gap-2 p-8 text-center"
      role="alert"
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      <p className="text-base font-medium">{title}</p>
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
