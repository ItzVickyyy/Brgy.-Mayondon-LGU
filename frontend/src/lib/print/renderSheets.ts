/**
 * Draws an issued document to page images for "Save as PDF / Word" (the DOM half; the file builders are in exportDocument.ts).
 * Same layout step as the printer (`layoutOverlay`), always on the barangay's own blank form, so the saved file is complete without a pre-printed sheet.
 */
import type { PrintData } from "./buildPrintData"
import type { SheetImage } from "./exportDocument"
import { formBackgrounds } from "./formBackgrounds"
import {
  DEFAULT_FONT_PT,
  LINE_HEIGHT_RATIO,
  layoutOverlay,
  STAMP_FONT_PT,
  STAMP_LINE,
  STAMP_PAD,
  STAMP_VALUE_DX,
} from "./overlayLayout"
import { LABEL_FONT, STAMP_FONT, VALUE_FONT } from "./overlayStyles"
import { paperDimensions } from "./paperSizes"
import { printTemplates } from "./templates"

/** 2.5 pixels per point is about 180 dpi: sharp on screen and on paper, a few hundred KB per page. */
const SCALE = 2.5
const FONT = VALUE_FONT

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = url
  })
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("The page image could not be made."))
        void blob
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)), reject)
      },
      type,
      quality,
    )
  })
}

export type RenderedDocument = {
  sheets: SheetImage[]
  widthPt: number
  heightPt: number
}

export async function renderSheets(data: PrintData): Promise<RenderedDocument> {
  const template = printTemplates[data.templateId]
  const { widthPt, heightPt } = paperDimensions[template.paperSize]
  const backgrounds = formBackgrounds[data.templateId] ?? []
  const measureCanvas = document.createElement("canvas")
  const measureContext = measureCanvas.getContext("2d")
  const measure = (text: string, size: number) => {
    if (!measureContext) return text.length * size * 0.55
    measureContext.font = `bold ${size * SCALE}px ${FONT}`
    return measureContext.measureText(text).width / SCALE
  }
  const laid = layoutOverlay(data, measure)
  // Every sheet that has a form image is saved, also one without a typed value.
  const pageNumbers = [
    ...new Set([
      ...laid.map((page) => page.page),
      ...backgrounds.flatMap((url, page) => (url ? [page] : [])),
    ]),
  ].sort((a, b) => a - b)
  const photo = data.photoUrl ? await loadImage(data.photoUrl) : undefined

  const sheets: SheetImage[] = []
  for (const pageNumber of pageNumbers) {
    const page = laid.find((item) => item.page === pageNumber)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(widthPt * SCALE)
    canvas.height = Math.round(heightPt * SCALE)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("The page image could not be made.")
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    const backgroundUrl = backgrounds[pageNumber]
    if (backgroundUrl) {
      const background = await loadImage(backgroundUrl)
      if (background)
        context.drawImage(background, 0, 0, canvas.width, canvas.height)
    }
    if (page?.photo && photo) {
      // Fill the photo box and crop the overflow, like `object-fit: cover` on the printed sheet.
      const box = page.photo
      const ratio = Math.max(
        box.w / photo.naturalWidth,
        box.h / photo.naturalHeight,
      )
      const sourceW = box.w / ratio
      const sourceH = box.h / ratio
      context.drawImage(
        photo,
        (photo.naturalWidth - sourceW) / 2,
        (photo.naturalHeight - sourceH) / 2,
        sourceW,
        sourceH,
        box.x * SCALE,
        box.y * SCALE,
        box.w * SCALE,
        box.h * SCALE,
      )
    }
    context.fillStyle = "#000000"
    context.textBaseline = "middle"
    if (page?.stamp) {
      const box = page.stamp
      context.strokeStyle = "#000000"
      context.lineWidth = 0.75 * SCALE
      context.strokeRect(
        box.x * SCALE,
        box.y * SCALE,
        box.w * SCALE,
        box.h * SCALE,
      )
      context.textAlign = "left"
      ;[{ label: box.title, value: "" }, ...box.rows].forEach((row, index) => {
        const middle =
          (box.y + STAMP_PAD + index * STAMP_LINE + STAMP_LINE / 2) * SCALE
        context.font = `${STAMP_FONT_PT * SCALE}px ${STAMP_FONT}`
        context.fillText(row.label, (box.x + STAMP_PAD) * SCALE, middle)
        if (row.value) {
          context.font = `bold ${STAMP_FONT_PT * SCALE}px ${STAMP_FONT}`
          context.fillText(row.value, (box.x + STAMP_VALUE_DX) * SCALE, middle)
        }
      })
    }
    const lineMiddle = (DEFAULT_FONT_PT * LINE_HEIGHT_RATIO) / 2
    for (const item of page?.texts ?? []) {
      context.font =
        item.font === "note"
          ? `${item.size * SCALE}px ${STAMP_FONT}`
          : `bold ${item.size * SCALE}px ${item.font === "label" ? LABEL_FONT : FONT}`
      context.textAlign = item.align === "center" ? "center" : "left"
      context.fillStyle = item.color ?? "#000000"
      context.fillText(item.text, item.x * SCALE, (item.y + lineMiddle) * SCALE)
      context.fillStyle = "#000000"
    }
    context.font = `bold ${DEFAULT_FONT_PT * SCALE}px ${FONT}`
    context.textAlign = "center"
    for (const mark of page?.marks ?? [])
      context.fillText("X", mark.x * SCALE, mark.y * SCALE)
    sheets.push({
      jpeg: await toBlob(canvas, "image/jpeg", 0.92),
      png: await toBlob(canvas, "image/png"),
      widthPx: canvas.width,
      heightPx: canvas.height,
    })
  }
  return { sheets, widthPt, heightPt }
}
