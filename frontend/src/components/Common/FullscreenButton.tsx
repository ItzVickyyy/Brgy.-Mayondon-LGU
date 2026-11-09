import { Maximize2, Minimize2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

// Full-screen toggle for the sign-in pages, styled like the theme button.
// Hidden where the browser cannot do full screen (for example iPhone Safari).
export function FullscreenButton() {
  const { t } = useTranslation()
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement))
    sync()
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  if (typeof document === "undefined" || !document.fullscreenEnabled) {
    return null
  }

  const label = isFullscreen
    ? t("common.ui.exitFullscreen")
    : t("common.ui.enterFullscreen")

  return (
    <Button
      type="button"
      data-testid="fullscreen-button"
      variant="outline"
      size="icon"
      className="border-border bg-background/80 shadow-sm backdrop-blur"
      aria-label={label}
      title={label}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      }}
    >
      {isFullscreen ? (
        <Minimize2 className="size-4" />
      ) : (
        <Maximize2 className="size-4" />
      )}
    </Button>
  )
}
