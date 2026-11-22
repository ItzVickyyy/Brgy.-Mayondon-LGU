import { Info } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { AboutDialog } from "@/components/Common/InfoDialogs"
import { cn } from "@/lib/utils"

/** Opens the "About this system" popup. Used on the login page. */
export function AboutButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        data-testid="about-button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Info aria-hidden="true" className="size-4" />
        {t("login.about")}
      </button>
      <AboutDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
