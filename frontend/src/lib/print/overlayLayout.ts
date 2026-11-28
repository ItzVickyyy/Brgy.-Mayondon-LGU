/**
 * Pure layout step for the print overlay (see docs/04-Documents-and-Printing.md section 7): template + values -> positioned items.
 * No DOM, so it is unit tested. All positions are PostScript points from the top-left of the Letter page.
 */
import type { PrintData } from "./buildPrintData"
import { printTemplates } from "./templates"

export const DEFAULT_FONT_PT = 11 // the line box every `y` is measured against
export const VALUE_FONT_PT = 12 // typed values, like the 12 pt of Clearance Issuing.xls
export const STAMP_FONT_PT = 8
export const STAMP_PAD = 4
export const STAMP_LINE = 11.5
export const STAMP_VALUE_DX = 84 // value column, from the left edge of the box
export const MIN_FONT_PT = 7
export const LINE_HEIGHT_RATIO = 1.2 // `y` in templates.ts is the top of a line this tall
export type Offset = { x: number; y: number }

export type OverlayText = {
  key: string
  text: string
  x: number
  y: number
  size: number
  align: "left" | "center"
  font: "value" | "label" | "note" | "form" | "formRegular"
  color?: string
}
export type OverlayStamp = {
  x: number
  y: number
  w: number
  h: number
  title: string
  rows: { label: string; value: string }[]
}
export type OverlayMark = { key: string; x: number; y: number }
export type OverlayPhoto = {
  url: string
  x: number
  y: number
  w: number
  h: number
}
export type OverlayPage = {
  page: number
  texts: OverlayText[]
  marks: OverlayMark[]
  photo?: OverlayPhoto
  stamp?: OverlayStamp
}

/** Largest font size (pt) <= `size` at which `text` fits `maxWidth`, never below `minSize`. `measure(text, size)` returns width in pt. */
export function fitFontSize(
  text: string,
  maxWidth: number | undefined,
  size: number,
  measure: (text: string, size: number, font?: string) => number,
  minSize = MIN_FONT_PT,
  font?: string,
): number {
  if (!maxWidth || !text) return size
  const width = measure(text, size, font)
  if (width <= maxWidth) return size
  return Math.max(minSize, Math.floor(((size * maxWidth) / width) * 10) / 10)
}

/** Builds one entry per sheet that has content. Empty values print nothing; marks print only for the matching value. */
export function layoutOverlay(
  data: PrintData,
  measure: (text: string, size: number, font?: string) => number,
  offset: Offset = { x: 0, y: 0 },
): OverlayPage[] {
  const template = printTemplates[data.templateId]
  const pageNumbers = [
    ...new Set([
      ...template.fields.map((f) => f.page ?? 0),
      ...(template.marks ?? []).map((m) => m.page ?? 0),
      ...(template.photo ? [template.photo.page ?? 0] : []),
      ...(template.stamp ? [template.stamp.page ?? 0] : []),
    ]),
  ].sort((a, b) => a - b)

  return pageNumbers.map((page) => {
    const texts: OverlayText[] = []
    for (const field of template.fields) {
      if ((field.page ?? 0) !== page) continue
      const value = (data.values[field.key] ?? "").trim()
      if (!value) continue
      const text = `${field.prefix ?? ""}${value}`
      texts.push({
        key: field.key,
        text,
        x: field.x + offset.x,
        y: field.y + offset.y,
        align: field.align ?? "left",
        font: field.font ?? "value",
        ...(field.color ? { color: field.color } : {}),
        size: fitFontSize(
          text,
          field.w,
          field.size ?? VALUE_FONT_PT,
          measure,
          MIN_FONT_PT,
          field.font ?? "value",
        ),
      })
    }
    const marks: OverlayMark[] = (template.marks ?? [])
      .filter(
        (mark) =>
          (mark.page ?? 0) === page && data.values[mark.key] === mark.when,
      )
      .map((mark) => ({
        key: mark.key,
        x: mark.x + offset.x,
        y: mark.y + offset.y,
      }))
    const box =
      template.photo && (template.photo.page ?? 0) === page
        ? template.photo
        : undefined
    const photo =
      box && data.photoUrl
        ? {
            url: data.photoUrl,
            x: box.x + offset.x,
            y: box.y + offset.y,
            w: box.w,
            h: box.h,
          }
        : undefined
    const stampBox = template.stamp
    const stamp =
      stampBox && (stampBox.page ?? 0) === page
        ? {
            x: stampBox.x + offset.x,
            y: stampBox.y + offset.y,
            w: stampBox.w,
            h: stampBox.h,
            title: '"DOCUMENTARY STAMP TAX PAID"',
            rows: [
              {
                label: "Official Receipt No.:",
                value: data.values.stampOr ?? "",
              },
              { label: "Date of Payment:", value: data.values.stampDate ?? "" },
              { label: "Certified by:", value: data.values.stampBy ?? "" },
            ],
          }
        : undefined
    return { page, texts, marks, photo, stamp }
  })
}
