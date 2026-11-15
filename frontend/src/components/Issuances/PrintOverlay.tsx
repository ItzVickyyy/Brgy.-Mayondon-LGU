import { useMemo } from "react"
import { createPortal } from "react-dom"
import type { PrintData } from "@/lib/print/buildPrintData"
import {
  DEFAULT_FONT_PT,
  LINE_HEIGHT_RATIO,
  layoutOverlay,
  type Offset,
} from "@/lib/print/overlayLayout"
import { printOverlayCss } from "@/lib/print/overlayStyles"

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
  backgrounds?: string[] // the barangay's own blank form, one image per sheet, printed behind the values ("form and data")
  preview?: boolean // show on screen for calibration/verification; never used for real printing
}

/** Renders the overlay for `data` into document.body. Call `window.print()` while it is mounted. */
export function PrintOverlay({
  data,
  offset,
  backgrounds,
  preview = false,
}: Props) {
  const pages = useMemo(() => {
    const laid = layoutOverlay(data, measureText, offset)
    if (!backgrounds?.length) return laid
    // Every sheet that has a form image prints, also one without a typed value. An empty entry means "not part of this form".
    const sheets = new Set([
      ...laid.map((p) => p.page),
      ...backgrounds.flatMap((url, page) => (url ? [page] : [])),
    ])
    return [...sheets]
      .sort((x, y) => x - y)
      .map(
        (page) =>
          laid.find((p) => p.page === page) ?? {
            page,
            texts: [],
            marks: [],
            photo: undefined,
          },
      )
  }, [data, offset, backgrounds])
  return createPortal(
    <div className="print-overlay-root" data-preview={preview}>
      <style>{printOverlayCss}</style>
      {pages.map((page) => (
        <div
          className="print-overlay-page"
          key={page.page}
          data-page={page.page}
        >
          {backgrounds?.[page.page] && (
            <img
              className="print-overlay-bg"
              src={backgrounds[page.page]}
              alt=""
              style={{ left: 0, top: 0, width: "612pt", height: "792pt" }}
            />
          )}
          {page.photo && (
            <img
              src={page.photo.url}
              alt=""
              style={{
                left: `${page.photo.x}pt`,
                top: `${page.photo.y}pt`,
                width: `${page.photo.w}pt`,
                height: `${page.photo.h}pt`,
                objectFit: "cover",
              }}
            />
          )}
          {page.texts.map((item, index) => (
            <span
              key={`${item.key}-${index}`}
              style={{
                left: `${item.x}pt`,
                top: `${item.y}pt`,
                fontSize: `${item.size}pt`,
                lineHeight: `${DEFAULT_FONT_PT * LINE_HEIGHT_RATIO}pt`,
                transform:
                  item.align === "center" ? "translateX(-50%)" : undefined,
              }}
            >
              {item.text}
            </span>
          ))}
          {page.marks.map((mark, index) => (
            <span
              key={`${mark.key}-m${index}`}
              style={{
                left: `${mark.x}pt`,
                top: `${mark.y}pt`,
                fontSize: `${DEFAULT_FONT_PT}pt`,
                fontWeight: 700,
                lineHeight: 1,
                transform: "translate(-50%, -50%)",
              }}
            >
              X
            </span>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  )
}
