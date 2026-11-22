import { ArrowUp } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const SHOW_AFTER_PX = 480

/** A round button that appears after scrolling down and returns to the top of the page. */
export function BackToTop() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const label = t("common.ui.backToTop")

  return (
    <button
      type="button"
      data-testid="back-to-top"
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      aria-hidden={visible ? undefined : true}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
        window.scrollTo({
          top: 0,
          behavior: reduce.matches ? "auto" : "smooth",
        })
      }}
      className={`fixed right-4 bottom-4 z-40 flex size-11 items-center justify-center rounded-full border bg-primary text-primary-foreground shadow-lg outline-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 print:hidden sm:right-6 sm:bottom-6 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  )
}
