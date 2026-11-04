import { useMemo } from "react"
import { createPortal } from "react-dom"
import type { PrintData } from "@/lib/print/buildPrintData"
import { printOverlayCss } from "@/lib/print/overlayStyles"
import { DEFAULT_FONT_PT, LINE_HEIGHT_RATIO, layoutOverlay, type Offset } from "@/lib/print/overlayLayout"

let canvas: HTMLCanvasElement | undefined
function measureText(text: string, sizePt: number): number {
  canvas ??= document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return text.length * sizePt * 0.55 // rough fallback
  ctx.font = `${sizePt}pt Arial, Helvetica, sans-serif` // canvas px == CSS px, so convert the result back to pt
  return ctx.measureText(text).width * 0.75
}

type Props = {
  data: PrintData
  offset?: Offset // calibration offset in pt (step 4)
  preview?: boolean // show on screen for calibration/verification; never used for real printing
}

/** Renders the overlay for `data` into document.body. Call `window.print()` while it is mounted. */
export function PrintOverlay({ data, offset, preview = false }: Props) {
  const pages = useMemo(() => layoutOverlay(data, measureText, offset), [data, offset])
  return createPortal(
    <div className="print-overlay-root" data-preview={preview}>
      <style>{printOverlayCss}</style>
      {pages.map((page) => (
        <div className="print-overlay-page" key={page.page} data-page={page.page}>
          {page.photo && (
            <img src={page.photo.url} alt="" style={{ left: `${page.photo.x}pt`, top: `${page.photo.y}pt`, width: `${page.photo.w}pt`, height: `${page.photo.h}pt`, objectFit: "cover" }} />
          )}
          {page.texts.map((item, index) => (
            <span key={`${item.key}-${index}`} style={{
              left: `${item.x}pt`, top: `${item.y}pt`, fontSize: `${item.size}pt`, lineHeight: `${DEFAULT_FONT_PT * LINE_HEIGHT_RATIO}pt`,
              transform: item.align === "center" ? "translateX(-50%)" : undefined,
            }}>{item.text}</span>
          ))}
          {page.marks.map((mark, index) => (
            <span key={`${mark.key}-m${index}`} style={{ left: `${mark.x}pt`, top: `${mark.y}pt`, fontSize: `${DEFAULT_FONT_PT}pt`, fontWeight: 700, lineHeight: 1, transform: "translate(-50%, -50%)" }}>X</span>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  )
}
