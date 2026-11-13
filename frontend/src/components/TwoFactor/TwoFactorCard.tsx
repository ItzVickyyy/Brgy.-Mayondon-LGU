import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { getLocale } from "@/lib/locale"
import { type ManageMode, TwoFactorManageDialog } from "./TwoFactorManageDialog"
import { TwoFactorSetupDialog } from "./TwoFactorSetupDialog"
import { useMfaStatus } from "./useMfaStatus"

/** The "Two-factor sign-in" card in My Account. */
export function TwoFactorCard() {
  const { t } = useTranslation()
  const { data } = useMfaStatus()
  const [setupOpen, setSetupOpen] = useState(false)
  const [manage, setManage] = useState<ManageMode | null>(null)
  const enabled = data?.enabled === true
  const remaining = data?.recovery_codes_remaining ?? 0
  const date = data?.enrolled_at
    ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
        new Date(data.enrolled_at),
      )
    : ""

  return (
    <div className="mt-4 rounded-xl border p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h4 className="text-sm font-semibold">{t("twoFactor.title")}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("twoFactor.cardDescription")}
          </p>
        </div>
      </div>

      {data && !data.available ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="mfa-unavailable"
        >
          {t("twoFactor.unavailable")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p
            className="text-sm"
            data-testid="mfa-status"
            data-enabled={enabled ? "true" : "false"}
          >
            {enabled
              ? t("twoFactor.statusOn", { date })
              : t("twoFactor.statusOff")}
          </p>
          {enabled ? (
            <>
              <p
                className={
                  remaining <= 2
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
                }
              >
                {t("twoFactor.codesLeft", { count: remaining })}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  onClick={() => setManage("codes")}
                >
                  {t("twoFactor.newCodes")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  onClick={() => setManage("disable")}
                >
                  {t("twoFactor.turnOff")}
                </Button>
              </div>
            </>
          ) : (
            <div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:min-h-9"
                disabled={!data}
                onClick={() => setSetupOpen(true)}
              >
                {t("twoFactor.turnOn")}
              </Button>
            </div>
          )}
        </div>
      )}
      <TwoFactorSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <TwoFactorManageDialog
        mode={manage}
        onOpenChange={(open) => {
          if (!open) setManage(null)
        }}
      />
    </div>
  )
}
