import { type PaperSize, pageRule, paperDimensions } from "./paperSizes"

/** Typed values use the barangay's own font (Cambria Bold in Clearance Issuing.xls); Caladea is the metric-compatible stand-in where Cambria is not installed. */
export const VALUE_FONT = "Cambria, Caladea, 'Times New Roman', serif"
/** The First-Time Jobseeker Word file is Verdana throughout; DejaVu Sans is the closest stand-in where Verdana is not installed. */
export const FORM_FONT = "Verdana, 'DejaVu Sans', Geneva, sans-serif"
/** Labels printed by the app (the Indigency SECTOR line) use the form's own label font. */
export const LABEL_FONT = "'Arial Narrow', 'Liberation Sans Narrow', 'Nimbus Sans Narrow', 'Helvetica Neue', Arial, sans-serif"
/** The stamp box is Arial in the same workbook. */
export const STAMP_FONT = "Arial, Helvetica, sans-serif"

// Shared by PrintOverlay and CalibrationSheet. Typed values only (docs/04 section 3): no labels, borders, logos or signatures. No margins, 100% scale; the page size comes from the document (Short or Long).
export const overlayCss = (size: PaperSize): string => `
${pageRule(size)}
.print-overlay-root { display: none }
.print-overlay-root[data-preview="true"] { display: block; position: fixed; inset: 0; z-index: 9999; overflow: auto; background: #888; padding: 16px }
.print-overlay-page { position: relative; width: ${paperDimensions[size].widthPt}pt; height: ${paperDimensions[size].heightPt}pt; overflow: hidden; background: #fff; margin: 0 auto 16px;
  font-family: ${VALUE_FONT}; font-weight: 700; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.print-overlay-page > * { position: absolute; white-space: nowrap }
@media print {
  html, body { margin: 0 !important; padding: 0 !important }
  body > *:not(.print-overlay-root) { display: none !important }
  /* The Issuances page hides body descendants with visibility for its own print preview; the overlay must opt back in. */
  .print-overlay-root, .print-overlay-root * { visibility: visible !important }
  .print-overlay-root, .print-overlay-root[data-preview="true"] { display: block !important; position: static; padding: 0; background: none; overflow: visible }
  .print-overlay-page { margin: 0; break-after: page; break-inside: avoid }
  .print-overlay-page:last-child { break-after: auto }
}
`

/** The Short (Letter) stylesheet, for callers and tests that do not care about the size. */
export const printOverlayCss = overlayCss("short")
