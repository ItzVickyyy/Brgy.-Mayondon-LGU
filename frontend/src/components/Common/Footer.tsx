import { SITE } from "@/config/site"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="text-sm text-muted-foreground">
          © {currentYear} {SITE.fullName}, {SITE.location}
        </p>

      </div>
    </footer>
  )
}
