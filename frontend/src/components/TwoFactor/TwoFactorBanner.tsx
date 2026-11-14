import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { TwoFactorSetupDialog } from "./TwoFactorSetupDialog"
import { useMfaStatus } from "./useMfaStatus"

/**
 * A banner above every page until two-factor sign-in is on, for a System
 * Administrator (always) and for a staff member an administrator asked to use
 * it. There is no "Not now". It never blocks a sign-in.
 */
export function TwoFactorBanner() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data } = useMfaStatus(Boolean(user))
  const [open, setOpen] = useState(false)

  const isAdmin = user?.role === "admin" || user?.is_superuser === true
  const show =
    Boolean(user) &&
    data?.available === true &&
    data.enabled === false &&
    (isAdmin || data.required === true)

  return (
    <>
      {show ? (
        <div
          role="status"
          data-testid="two-factor-banner"
          className="flex flex-col gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <ShieldCheck
            className="hidden size-5 shrink-0 sm:block"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1">
            {isAdmin
              ? t("twoFactor.banner.admin")
              : t("twoFactor.banner.staff")}
          </p>
          <Button
            type="button"
            size="sm"
            className="min-h-11 shrink-0 sm:min-h-8"
            onClick={() => setOpen(true)}
          >
            {t("twoFactor.banner.action")}
          </Button>
        </div>
      ) : null}
      {/* Outside the conditional: when two-factor turns on, the banner goes away
          but the dialog must stay open to show the one-time recovery codes. */}
      <TwoFactorSetupDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
