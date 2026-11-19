/**
 * Paper sizes used by the barangay's documents (owner decision, Nov 18, 2026).
 * Short = Letter, 8.5 x 11 in. Long = 8.5 x 13 in (the Philippine "long bond"; this is not US Legal, which is 8.5 x 14 in).
 * Units are PostScript points (1/72 in), measured from the top-left corner. One place decides the page size for the
 * print CSS (`@page`), the page box on screen, the form images and the calibration sheet, so they cannot disagree.
 */
export type PaperSize = "short" | "long"

export const paperDimensions = {
  short: {
    widthPt: 612,
    heightPt: 792,
    css: "8.5in 11in",
    label: "8.5 x 11 in",
  },
  long: {
    widthPt: 612,
    heightPt: 936,
    css: "8.5in 13in",
    label: "8.5 x 13 in",
  },
} as const satisfies Record<
  PaperSize,
  { widthPt: number; heightPt: number; css: string; label: string }
>

/** The `@page` rule for a paper size. No margins: the templates position everything themselves. */
export const pageRule = (size: PaperSize): string =>
  `@page { size: ${paperDimensions[size].css}; margin: 0 }`

/** The `@page` rule for a printed Management Report: short paper with real margins, because a report is a flowing table, not a form with fixed positions. */
export const reportPageRule = (): string =>
  `@page { size: ${paperDimensions.short.css}; margin: 0.6in }`
