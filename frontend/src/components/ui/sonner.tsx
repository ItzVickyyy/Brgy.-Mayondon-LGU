"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useEffect } from "react"
import { useTheme } from "@/components/theme-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  // Clicking anywhere on a toast closes it (it has its own X as well). Buttons
  // and links inside a toast (an action, the X itself) keep their own click.
  useEffect(() => {
    const closeOnClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const toastElement = target?.closest("[data-sonner-toast]")
      if (!toastElement || target?.closest("button, a, [role='button']")) return
      toastElement.querySelector<HTMLElement>("[data-close-button]")?.click()
    }
    document.addEventListener("click", closeOnClick)
    return () => document.removeEventListener("click", closeOnClick)
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{ classNames: { toast: "app-toast" } }}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "340px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
