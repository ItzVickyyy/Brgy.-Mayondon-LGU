import { AlertCircle, Inbox, LoaderCircle, RotateCw } from "lucide-react"
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
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCw className="mr-2 size-4" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function LoadingState({ title = "Loading..." }: { title?: string }) {
  return (
    <div
      className="flex min-h-24 items-center justify-center gap-2 p-6 text-base text-muted-foreground"
      role="status"
    >
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span>{title}</span>
    </div>
  )
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: ErrorStateProps) {
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
    </div>
  )
}
