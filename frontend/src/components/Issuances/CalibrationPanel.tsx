import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalibrationSheet } from "@/components/Issuances/CalibrationSheet"
import { MAX_OFFSET_PT, clampOffset, getOffset, saveOffset } from "@/lib/print/calibration"
import { printTemplates, type PrintTemplateId } from "@/lib/print/templates"

const labels: Record<PrintTemplateId, string> = {
  clearance: "Barangay Clearance", franchise: "Franchise Clearance", utility: "Electrical and Water", indigency: "Indigency",
  marginalized: "Marginalized Sector", assistance: "Assistance Certification",
}

/** Offset editor + calibration sheet button. Mounted by step 5 (e.g. in a "Printing" settings dialog). */
export function CalibrationPanel() {
  const [templateId, setTemplateId] = useState<PrintTemplateId>("clearance")
  const [offset, setOffset] = useState(() => getOffset("clearance"))
  const [printing, setPrinting] = useState(false)
  const [saved, setSaved] = useState<boolean | null>(null)

  const choose = (id: PrintTemplateId) => { setTemplateId(id); setOffset(getOffset(id)); setSaved(null) }
  const change = (axis: "x" | "y", value: string) => { setOffset((current) => ({ ...current, [axis]: Number(value) || 0 })); setSaved(null) }
  const save = () => { const clean = clampOffset(offset); setOffset(clean); setSaved(saveOffset(templateId, clean)) }
  const printSheet = () => {
    setPrinting(true)
    // Wait for the sheet to mount, print, then unmount it.
    window.setTimeout(() => { window.print(); setPrinting(false) }, 100)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Print the calibration sheet on plain paper at 100% scale (no headers, footers or fit-to-page), then hold it against the pre-printed form. Adjust the offset until the red boxes sit on the blanks.</p>
      <div className="space-y-2">
        <Label htmlFor="calibration-template">Form</Label>
        <select id="calibration-template" className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={templateId} onChange={(e) => choose(e.target.value as PrintTemplateId)}>
          {(Object.keys(printTemplates) as PrintTemplateId[]).map((id) => <option key={id} value={id}>{labels[id]}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="calibration-x">Shift right (pt)</Label><Input id="calibration-x" type="number" step="0.5" min={-MAX_OFFSET_PT} max={MAX_OFFSET_PT} value={offset.x} onChange={(e) => change("x", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="calibration-y">Shift down (pt)</Label><Input id="calibration-y" type="number" step="0.5" min={-MAX_OFFSET_PT} max={MAX_OFFSET_PT} value={offset.y} onChange={(e) => change("y", e.target.value)} /></div>
      </div>
      <p className="text-xs text-muted-foreground">72 pt = 1 inch, about 2.8 pt = 1 mm. Limit {MAX_OFFSET_PT} pt either way.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save}>Save offset</Button>
        <Button type="button" variant="outline" onClick={printSheet} disabled={printing}>Print calibration sheet</Button>
        <Button type="button" variant="ghost" onClick={() => { setOffset({ x: 0, y: 0 }); setSaved(null) }}>Reset to 0</Button>
      </div>
      {saved === true && <p className="text-sm">Saved on this computer.</p>}
      {saved === false && <p className="text-sm text-destructive">Could not save: browser storage is unavailable.</p>}
      {printing && <CalibrationSheet templateId={templateId} offset={clampOffset(offset)} />}
    </div>
  )
}
