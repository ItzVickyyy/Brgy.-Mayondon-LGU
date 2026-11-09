import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"

// Shown while a page is being prepared, so the screen keeps its shape instead
// of showing a spinner. Purely visual: the status text is for screen readers.

function ContentSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            // Identical placeholders; their order never changes.
            key={index}
            className="space-y-3 rounded-lg border bg-card p-5"
          >
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-9 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="hidden h-6 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The content area of a page (used inside the signed-in layout). */
export function PageSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.feedback.loading")}</span>
      <ContentSkeleton />
    </div>
  )
}

/** The whole signed-in screen: navy sidebar, top bar and page, as blocks. */
export function AppShellSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh bg-background" role="status" aria-busy="true">
      <span className="sr-only">{t("common.feedback.loading")}</span>
      <div
        aria-hidden="true"
        className="hidden w-64 shrink-0 flex-col gap-3 bg-sidebar p-4 md:flex"
      >
        <div className="flex h-12 items-center gap-3 border-b border-sidebar-border pb-3">
          <div className="size-8 rounded-md bg-white/10" />
          <div className="h-4 w-28 rounded-md bg-white/10" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-2 py-2">
            <div className="size-5 rounded bg-white/10" />
            <div className="h-3.5 w-28 rounded bg-white/10" />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" aria-hidden="true">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="size-9" />
            <Skeleton className="size-9" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="flex-1 p-4 sm:p-6 md:p-8">
          <ContentSkeleton />
        </div>
      </div>
    </div>
  )
}
