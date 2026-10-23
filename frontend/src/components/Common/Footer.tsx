import { SITE } from "@/config/site"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="text-sm text-muted-foreground">
          © {currentYear} {SITE.fullName}, {SITE.location}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:justify-end">
          <span>Draft build · v0.1.0</span>
          <span aria-hidden="true">·</span>
          <span>Terms of Use (draft)</span>
          <span aria-hidden="true">·</span>
          <span>Privacy Policy (draft)</span>
        </div>
      </div>
    </footer>
  )
}
