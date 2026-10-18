import { SITE } from "@/config/site"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t py-4 px-6">
      <div className="flex flex-col items-center justify-between gap-1 text-center sm:flex-row sm:text-left">
        <p className="text-muted-foreground text-sm">
          © {currentYear} {SITE.fullName}, {SITE.location}
        </p>
        <p className="text-muted-foreground text-xs">
          Developed by {SITE.developedBy}
        </p>
      </div>
    </footer>
  )
}
