import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalibrationSheet } from "@/components/Issuances/CalibrationSheet"
import { MAX_OFFSET_PT, clampOffset, getOffset, saveOffset } from "@/lib/print/calibration"
import { printTemplates, type PrintTemplateId } from "@/lib/print/templates"

/** Offset editor + calibration sheet button. Mounted by step 5 (e.g. in a "Printing" settings dialog). */
export function CalibrationPanel() {
  const { t } = useTranslation()
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
      <p className="text-sm text-muted-foreground">{t("issuances.printing.calibration.intro")}</p>
      <div className="space-y-2">
        <Label htmlFor="calibration-template">{t("issuances.printing.calibration.form")}</Label>
        <select id="calibration-template" className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={templateId} onChange={(e) => choose(e.target.value as PrintTemplateId)}>
          {(Object.keys(printTemplates) as PrintTemplateId[]).map((id) => <option key={id} value={id}>{t(`issuances.printing.calibration.templates.${id}`)}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="calibration-x">{t("issuances.printing.calibration.shiftRight")}</Label><Input id="calibration-x" type="number" step="0.5" min={-MAX_OFFSET_PT} max={MAX_OFFSET_PT} value={offset.x} onChange={(e) => change("x", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="calibration-y">{t("issuances.printing.calibration.shiftDown")}</Label><Input id="calibration-y" type="number" step="0.5" min={-MAX_OFFSET_PT} max={MAX_OFFSET_PT} value={offset.y} onChange={(e) => change("y", e.target.value)} /></div>
      </div>
      <p className="text-xs text-muted-foreground">{t("issuances.printing.calibration.units", { max: MAX_OFFSET_PT })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save}>{t("issuances.printing.calibration.save")}</Button>
        <Button type="button" variant="outline" onClick={printSheet} disabled={printing}>{t("issuances.printing.calibration.printSheet")}</Button>
        <Button type="button" variant="ghost" onClick={() => { setOffset({ x: 0, y: 0 }); setSaved(null) }}>{t("issuances.printing.calibration.reset")}</Button>
      </div>
      {saved === true && <p className="text-sm">{t("issuances.printing.calibration.saved")}</p>}
      {saved === false && <p className="text-sm text-destructive">{t("issuances.printing.calibration.saveFailed")}</p>}
      {printing && <CalibrationSheet templateId={templateId} offset={clampOffset(offset)} />}
    </div>
  )
}
