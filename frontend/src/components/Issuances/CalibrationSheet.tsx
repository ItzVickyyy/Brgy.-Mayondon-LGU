import { createPortal } from "react-dom"
import { GRID_STEP_PT, SCALE_BAR_PT, layoutCalibrationSheet } from "@/lib/print/calibration"
import type { Offset } from "@/lib/print/overlayLayout"
import { printOverlayCss } from "@/lib/print/overlayStyles"
import { printTemplates, type PrintTemplateId } from "@/lib/print/templates"

type Props = { templateId: PrintTemplateId; offset?: Offset; preview?: boolean }

/** Plain-paper test sheet (docs/04 section 7). Print it at 100% scale, then hold it against the pre-printed form. Never print on official stock. */
export function CalibrationSheet({ templateId, offset = { x: 0, y: 0 }, preview = false }: Props) {
  const { widthPt, heightPt } = printTemplates[templateId].paper
  const pages = layoutCalibrationSheet(templateId, offset)
  const grid = "#9ca3af"
  return createPortal(
    <div className="print-overlay-root" data-preview={preview}>
      <style>{printOverlayCss}</style>
      {pages.map((page) => (
        <div className="print-overlay-page" key={page.page} data-page={page.page}>
          <svg width={`${widthPt}pt`} height={`${heightPt}pt`} viewBox={`0 0 ${widthPt} ${heightPt}`} style={{ position: "absolute", left: 0, top: 0 }}>
            {page.vLines.map((x) => <line key={`v${x}`} x1={x} y1={0} x2={x} y2={heightPt} stroke={grid} strokeWidth={x % 72 === 0 ? 0.6 : 0.25} />)}
            {page.hLines.map((y) => <line key={`h${y}`} x1={0} y1={y} x2={widthPt} y2={y} stroke={grid} strokeWidth={y % 72 === 0 ? 0.6 : 0.25} />)}
            {page.vLines.filter((x) => x % 72 === 0 && x > 0).map((x) => <text key={`vt${x}`} x={x + 2} y={9} fontSize={6} fill="#374151">{x}</text>)}
            {page.hLines.filter((y) => y % 72 === 0 && y > 0).map((y) => <text key={`ht${y}`} x={2} y={y - 2} fontSize={6} fill="#374151">{y}</text>)}
            {page.fields.map((box, i) => (
              <g key={`f${i}`}>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke="#dc2626" strokeWidth={0.6} />
                <text x={box.x + 1} y={box.y - 1} fontSize={5} fill="#dc2626">{box.label}</text>
              </g>
            ))}
            {page.marks.map((box, i) => (
              <g key={`m${i}`}>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke="#2563eb" strokeWidth={0.6} />
                <text x={box.x + box.w + 1} y={box.y + 6} fontSize={5} fill="#2563eb">{box.label}</text>
              </g>
            ))}
            {page.photo && <rect x={page.photo.x} y={page.photo.y} width={page.photo.w} height={page.photo.h} fill="none" stroke="#059669" strokeWidth={0.6} strokeDasharray="3 2" />}
            {/* Scale bar: if it does not measure 5 in (127 mm), the printer scaled the page. */}
            <line x1={36} y1={heightPt - 36} x2={36 + SCALE_BAR_PT} y2={heightPt - 36} stroke="#000" strokeWidth={0.8} />
            <line x1={36} y1={heightPt - 41} x2={36} y2={heightPt - 31} stroke="#000" strokeWidth={0.8} />
            <line x1={36 + SCALE_BAR_PT} y1={heightPt - 41} x2={36 + SCALE_BAR_PT} y2={heightPt - 31} stroke="#000" strokeWidth={0.8} />
            <text x={36} y={heightPt - 44} fontSize={7} fill="#000">
              {`CALIBRATION - ${templateId} - page ${page.page + 1} - offset x ${offset.x} y ${offset.y} pt - this bar must measure 5 in (127 mm); grid = ${GRID_STEP_PT} pt`}
            </text>
          </svg>
        </div>
      ))}
    </div>,
    document.body,
  )
}
