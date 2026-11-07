import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  PrivacyDialog,
  TermsDialog,
  VersionDialog,
} from "@/components/Common/InfoDialogs"
import { SITE } from "@/config/site"

type Popup = "version" | "terms" | "privacy" | null

const linkClass =
  "rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const [popup, setPopup] = useState<Popup>(null)
  const close = (open: boolean) => {
    if (!open) setPopup(null)
  }

  return (
    <footer className="border-t px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="text-sm text-muted-foreground">
          © {currentYear} {SITE.fullName}, {SITE.location}
        </p>
        <nav
          aria-label={t("footer.ariaLabel")}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end"
        >
          <button
            type="button"
            className={linkClass}
            onClick={() => setPopup("version")}
          >
            {t("footer.version")}
          </button>
          <button
            type="button"
            className={linkClass}
            onClick={() => setPopup("terms")}
          >
            {t("footer.terms")}
          </button>
          <button
            type="button"
            className={linkClass}
            onClick={() => setPopup("privacy")}
          >
            {t("footer.privacy")}
          </button>
        </nav>
      </div>
      <VersionDialog open={popup === "version"} onOpenChange={close} />
      <TermsDialog open={popup === "terms"} onOpenChange={close} />
      <PrivacyDialog open={popup === "privacy"} onOpenChange={close} />
    </footer>
  )
}
