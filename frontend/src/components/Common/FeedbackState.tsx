import { AlertCircle, Inbox, LoaderCircle } from "lucide-react"

type StateProps = {
  title: string
  description?: string
}

export function EmptyState({ title, description }: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

export function LoadingState({ title = "Loading..." }: { title?: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center gap-2 p-6 text-base text-muted-foreground" role="status">
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span>{title}</span>
    </div>
  )
}

export function ErrorState({ title = "Something went wrong", description }: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center" role="alert">
      <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      <p className="text-base font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}
