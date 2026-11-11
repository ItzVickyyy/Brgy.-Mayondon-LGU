/**
 * Calibration support (docs/04-Documents-and-Printing.md sections 6 and 7): per-template X/Y offsets saved in
 * localStorage, and the layout of a plain-paper calibration sheet (grid, scale bar, field outlines). Pure apart from the
 * two storage helpers, which never throw.
 */
import {
  DEFAULT_FONT_PT,
  LINE_HEIGHT_RATIO,
  type Offset,
} from "./overlayLayout"
import { type PrintTemplateId, printTemplates } from "./templates"

export const CALIBRATION_STORAGE_KEY = "print-calibration-v1"
export const MAX_OFFSET_PT = 36 // half an inch either way; a bigger shift means the template, not the printer, is wrong
export const GRID_STEP_PT = 36
export const SCALE_BAR_PT = 360 // 5 in: must measure 127 mm on paper, otherwise the printer is scaling the page

export type OffsetMap = Partial<Record<PrintTemplateId, Offset>>

export function clampOffset(offset: Offset): Offset {
  const clean = (value: number) =>
    Number.isFinite(value)
      ? Math.round(
          Math.max(-MAX_OFFSET_PT, Math.min(MAX_OFFSET_PT, value)) * 10,
        ) / 10
      : 0
  return { x: clean(offset.x), y: clean(offset.y) }
}

/** Reads the saved JSON defensively: unknown templates, wrong types and bad JSON are ignored. */
export function parseOffsets(raw: string | null): OffsetMap {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const result: OffsetMap = {}
    for (const id of Object.keys(printTemplates) as PrintTemplateId[]) {
      const value = (parsed as Record<string, unknown>)[id]
      if (
        value &&
        typeof value === "object" &&
        typeof (value as Offset).x === "number" &&
        typeof (value as Offset).y === "number"
      ) {
        result[id] = clampOffset(value as Offset)
      }
    }
    return result
  } catch {
    return {}
  }
}

export function loadOffsets(): OffsetMap {
  try {
    return parseOffsets(window.localStorage.getItem(CALIBRATION_STORAGE_KEY))
  } catch {
    return {}
  }
}

export function getOffset(
  id: PrintTemplateId,
  offsets: OffsetMap = loadOffsets(),
): Offset {
  return offsets[id] ?? { x: 0, y: 0 }
}

/** Saves one template's offset (a zero offset removes it). Returns false when storage is unavailable. */
export function saveOffset(id: PrintTemplateId, offset: Offset): boolean {
  try {
    const offsets = loadOffsets()
    const clean = clampOffset(offset)
    if (clean.x === 0 && clean.y === 0) delete offsets[id]
    else offsets[id] = clean
    window.localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify(offsets),
    )
    return true
  } catch {
    return false
  }
}

export type CalibrationRect = {
  label: string
  x: number
  y: number
  w: number
  h: number
}
export type CalibrationSheetPage = {
  page: number
  vLines: number[] // x of vertical grid lines (pt), every GRID_STEP_PT
  hLines: number[] // y of horizontal grid lines (pt)
  fields: CalibrationRect[]
  marks: CalibrationRect[]
  photo?: CalibrationRect
}

const NO_WIDTH_BOX_PT = 120 // outline width for fields without `w`

/** Outlines every field, mark and photo box of a template at its current offset, over a fixed 0.5 in grid. */
export function layoutCalibrationSheet(
  id: PrintTemplateId,
  offset: Offset = { x: 0, y: 0 },
): CalibrationSheetPage[] {
  const template = printTemplates[id]
  const { widthPt, heightPt } = template.paper
  const lineHeight = DEFAULT_FONT_PT * LINE_HEIGHT_RATIO
  const pages = [
    ...new Set([
      ...template.fields.map((f) => f.page ?? 0),
      ...(template.marks ?? []).map((m) => m.page ?? 0),
      ...(template.photo ? [template.photo.page ?? 0] : []),
    ]),
  ].sort((a, b) => a - b)
  const vLines = Array.from(
    { length: Math.floor(widthPt / GRID_STEP_PT) + 1 },
    (_, i) => i * GRID_STEP_PT,
  ).filter((x) => x <= widthPt)
  const hLines = Array.from(
    { length: Math.floor(heightPt / GRID_STEP_PT) + 1 },
    (_, i) => i * GRID_STEP_PT,
  ).filter((y) => y <= heightPt)

  return pages.map((page) => ({
    page,
    vLines,
    hLines,
    fields: template.fields
      .filter((f) => (f.page ?? 0) === page)
      .map((f) => {
        const w = f.w ?? NO_WIDTH_BOX_PT
        const left = (f.align === "center" ? f.x - w / 2 : f.x) + offset.x
        return { label: f.key, x: left, y: f.y + offset.y, w, h: lineHeight }
      }),
    marks: (template.marks ?? [])
      .filter((m) => (m.page ?? 0) === page)
      .map((m) => ({
        label: `${m.key}=${m.when}`,
        x: m.x - 4 + offset.x,
        y: m.y - 4 + offset.y,
        w: 8,
        h: 8,
      })),
    photo:
      template.photo && (template.photo.page ?? 0) === page
        ? {
            label: "photo",
            x: template.photo.x + offset.x,
            y: template.photo.y + offset.y,
            w: template.photo.w,
            h: template.photo.h,
          }
        : undefined,
  }))
}
