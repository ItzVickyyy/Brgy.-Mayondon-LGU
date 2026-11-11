import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useIdleSignOut } from "@/hooks/useIdleSignOut"

/** Where the person lands after an automatic sign-out (the login page shows a notice). */
export const IDLE_SIGN_OUT_URL = "/login?idle=1"

// A full page load, not a router move, so nothing a person was looking at
// stays in memory.
function signOutAndLeave(url: string) {
  try {
    localStorage.removeItem("access_token")
  } catch {
    // Nothing more can be done if storage is blocked.
  }
  window.location.assign(url)
}

const signOutForInactivity = () => signOutAndLeave(IDLE_SIGN_OUT_URL)
const signOutNow = () => signOutAndLeave("/login")

/**
 * Warns for the last minute of inactivity, then signs the person out.
 * Mount once inside the signed-in layout.
 */
export function IdleSignOut() {
  const { t } = useTranslation()
  const { secondsLeft, stayActive } = useIdleSignOut(signOutForInactivity)
  const open = secondsLeft !== null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && stayActive()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("common.idle.title")}</DialogTitle>
          <DialogDescription>
            {t("common.idle.message", { seconds: secondsLeft ?? 0 })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={signOutNow}
          >
            {t("common.idle.signOutNow")}
          </Button>
          <Button type="button" className="min-h-11" onClick={stayActive}>
            {t("common.idle.stay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
