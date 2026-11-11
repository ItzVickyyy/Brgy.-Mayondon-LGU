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

interface FooterProps {
  /** "auth" is the quieter, centered footer used under the login forms. */
  variant?: "default" | "auth"
}

export function Footer({ variant = "default" }: FooterProps) {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const [popup, setPopup] = useState<Popup>(null)
  const close = (open: boolean) => {
    if (!open) setPopup(null)
  }

  const dialogs = (
    <>
      <VersionDialog open={popup === "version"} onOpenChange={close} />
      <TermsDialog open={popup === "terms"} onOpenChange={close} />
      <PrivacyDialog open={popup === "privacy"} onOpenChange={close} />
    </>
  )

  if (variant === "auth") {
    const authLink = `${linkClass} text-xs`
    return (
      <footer className="flex flex-col items-center gap-2 px-4 py-4 text-center">
        <nav
          aria-label={t("footer.ariaLabel")}
          className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        >
          <button
            type="button"
            className={authLink}
            onClick={() => setPopup("version")}
          >
            {t("footer.version")}
          </button>
          <span aria-hidden="true" className="text-xs text-muted-foreground/50">
            •
          </span>
          <button
            type="button"
            className={authLink}
            onClick={() => setPopup("terms")}
          >
            {t("footer.terms")}
          </button>
          <span aria-hidden="true" className="text-xs text-muted-foreground/50">
            •
          </span>
          <button
            type="button"
            className={authLink}
            onClick={() => setPopup("privacy")}
          >
            {t("footer.privacy")}
          </button>
        </nav>
        <p className="text-xs text-muted-foreground/80">
          © {currentYear} {SITE.fullName}, {SITE.location}
        </p>
        {dialogs}
      </footer>
    )
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
      {dialogs}
    </footer>
  )
}
