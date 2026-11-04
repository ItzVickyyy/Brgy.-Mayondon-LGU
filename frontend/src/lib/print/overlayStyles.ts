// Shared by PrintOverlay and CalibrationSheet. Typed values only (docs/04 section 3): no labels, borders, logos or signatures. Letter paper, no margins, 100% scale.
export const printOverlayCss = `
@page { size: letter; margin: 0 }
.print-overlay-root { display: none }
.print-overlay-root[data-preview="true"] { display: block; position: fixed; inset: 0; z-index: 9999; overflow: auto; background: #888; padding: 16px }
.print-overlay-page { position: relative; width: 612pt; height: 792pt; overflow: hidden; background: #fff; margin: 0 auto 16px;
  font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.print-overlay-page > * { position: absolute; white-space: nowrap }
@media print {
  body > *:not(.print-overlay-root) { display: none !important }
  /* The Issuances page hides body descendants with visibility for its own print preview; the overlay must opt back in. */
  .print-overlay-root, .print-overlay-root * { visibility: visible !important }
  .print-overlay-root, .print-overlay-root[data-preview="true"] { display: block !important; position: static; padding: 0; background: none; overflow: visible }
  .print-overlay-page { margin: 0; break-after: page; break-inside: avoid }
  .print-overlay-page:last-child { break-after: auto }
}
`
