import { type PaperSize, paperDimensions } from "./paperSizes"

/**
 * Print overlay templates (one per pre-printed form). Data only, no rendering.
 *
 * Units are PostScript points (1/72 in) from the TOP-LEFT of the page (Short = Letter, 612 x 792; see paperSizes.ts),
 * measured on the page images in public/assets/print-forms (made from docs/Barangay-softcopies/*.docx by scripts/build-print-forms.py; page 1 unless
 * `page` says otherwise). They are a first estimate: Word and LibreOffice lay out slightly
 * differently, so every template must be calibrated on real paper (docs/04 section 7).
 * `y` is the top of the text line, `x` the left edge (or the centre for `align: "center"`).
 * Rules from docs/04 section 3: typed values only, no labels, no signatures, no thumbmark area.
 */
export type PrintFieldBox = {
  key: string // value key supplied by the print data builder
  x: number
  y: number
  w?: number // max width; text shrinks to fit when set
  align?: "left" | "center"
  size?: number // font size in pt, default 11
  page?: number // 0-based page of a multi-page template, default 0
  font?: "value" | "label" | "note" | "form" // "form" = Verdana Bold (the First-Time Jobseeker Word file is all Verdana); "label" = Arial Narrow bold; "note" = Arial regular 10 pt (the Addressed-to line); default "value" (Cambria Bold)
  color?: string // text colour, default black (the loan note of the Clearance is red in the xls)
  prefix?: string // words printed before a non-empty value, for a row the barangay's form leaves unlabelled
}
export type PrintMarkBox = {
  key: string
  when: string
  x: number
  y: number
  page?: number
} // "X" centred on x,y when value === when
export type PrintPhotoBox = {
  x: number
  y: number
  w: number
  h: number
  page?: number
}
/** The "DOCUMENTARY STAMP TAX PAID" box of the barangay's clearances (Clearance Issuing.xls): a ruled box with the title and three lines, always printed. */
export type PrintStampBox = {
  x: number
  y: number
  w: number
  h: number
  page?: number
}
export type PrintTemplate = {
  id: PrintTemplateId
  documentCode: string
  paperSize: PaperSize
  paper: { widthPt: number; heightPt: number }
  /** True for a form that is not pre-printed stock (Residency, First-Time Jobseeker): it always prints with the blank form image, never as values only. */
  blankStock?: boolean
  fields: PrintFieldBox[]
  marks?: PrintMarkBox[]
  photo?: PrintPhotoBox
  stamp?: PrintStampBox
}
export type PrintTemplateId =
  | "clearance"
  | "franchise"
  | "utility"
  | "indigency"
  | "assistance"
  | "residency"
  | "jobseeker"

// A template is Short (Letter) unless it says `paperSize: "long"` (First-Time Jobseeker, 8.5 x 13 in).
const paper = {
  widthPt: paperDimensions.short.widthPt,
  heightPt: paperDimensions.short.heightPt,
}
const longPaper = {
  widthPt: paperDimensions.long.widthPt,
  heightPt: paperDimensions.long.heightPt,
}
// The additional statement of a Residency certificate has no ruled lines: six typed lines in the blank space under the first paragraph.
const statementLines = (): PrintFieldBox[] =>
  [0, 1, 2, 3, 4, 5].map((line) => ({
    key: `statement${line + 1}`,
    x: 72,
    y: 275 + line * 16.1,
    w: 468,
    size: 10.5,
  }))
// Three lines for a complete address on the Jobseeker applicant sheet: the first starts after the label, the others use the ruled lines below it.
const addressLines = (): PrintFieldBox[] => [
  { key: "addressLine1", x: 210, y: 263.2, w: 255, size: 11 },
  { key: "addressLine2", x: 74, y: 290.4, w: 358, size: 11 },
  { key: "addressLine3", x: 74, y: 317.6, w: 358, size: 11 },
]
// Verdana Bold has descenders that a value sitting exactly on its rule would run into; every Jobseeker value is lifted this far (pt) off the rule (patch 344).
const JOBSEEKER_LIFT = 1.5
const date = (y: number): PrintFieldBox => ({
  key: "date",
  x: 491,
  y,
  w: 172,
  align: "center",
}) // centred above the pre-printed Date line (x 405-577)

export const printTemplates: Record<PrintTemplateId, PrintTemplate> = {
  clearance: {
    id: "clearance",
    documentCode: "BARANGAY_CLEARANCE",
    paperSize: "short",
    paper,
    fields: [
      date(199),
      { key: "name", x: 135, y: 308.3, w: 255 },
      { key: "address", x: 135, y: 324.1, w: 255 },
      { key: "age", x: 135, y: 340 },
      { key: "birthdate", x: 135, y: 355.8 },
      { key: "birthplace", x: 135, y: 371.7, w: 255 },
      { key: "civilStatus", x: 135, y: 387.5 },
      { key: "purpose", x: 135, y: 418.8, w: 255 },
      // Clearance Issuing.xls: the note is Arial Narrow bold 14 pt in red (FF0000), REMARKS Cambria bold 14 pt; both sit on the lines below PURPOSE.
      {
        key: "purposeNote",
        x: 135,
        y: 433,
        w: 320,
        size: 14,
        font: "label",
        color: "#ff0000",
      },
      { key: "remarks", x: 135, y: 448.5, w: 320, size: 14 },
      // Bottom block: values go right of the colons at x 230.6 (measured on the page image of the barangay form).
      // Width stops at x 393 so the values never run into the stamp box (x 400-580).
      { key: "idType", x: 243, y: 608.9, w: 150, size: 11 },
      { key: "idNumber", x: 243, y: 623.3, w: 150, size: 11 },
      { key: "idPlace", x: 243, y: 637.7, w: 150, size: 11 },
      { key: "idDate", x: 243, y: 652.1, w: 150, size: 11 },
      { key: "orNumber", x: 243, y: 666.8, w: 150, size: 11 },
    ],
    stamp: { x: 400, y: 612, w: 180, h: 56 }, // right of the Valid I.D. block, below "DRY SEAL"
    photo: { x: 402, y: 325, w: 82, h: 79 }, // inside the pre-printed photo box (x 400.8-485.4, y 324.3-405.3) so its border stays visible; thumbmark box and signature line stay blank
  },
  franchise: {
    id: "franchise",
    documentCode: "FRANCHISE_CLEARANCE",
    paperSize: "short",
    paper,
    // Row `y` = label baseline minus 11 pt (a 12 pt Cambria line sits 11 pt below its `y`), so each value shares its label's baseline. Label baselines are measured on the form image public/assets/print-forms/franchise-0.png (Word's own export, 200 dpi); the LibreOffice render of the .docx spaces the rows differently (14.7 pt) and must not be used. Calibrate on paper (docs/04 section 7).
    fields: [
      { ...date(210), size: 12 },
      { key: "name", x: 207, y: 332.4, w: 330, size: 12 },
      { key: "address", x: 207, y: 351.9, w: 330, size: 12 },
      { key: "association", x: 207, y: 371.3, w: 330, size: 12 },
      { key: "make", x: 207, y: 406.6, size: 12 },
      { key: "bodyType", x: 207, y: 426.0, size: 12 },
      { key: "motorNumber", x: 207, y: 445.5, size: 12 },
      { key: "color", x: 207, y: 464.9, size: 12 },
      { key: "plateNumber", x: 207, y: 484.4, size: 12 },
      { key: "idNumber", x: 213, y: 629.8, w: 180, size: 12 }, // colons at x 201.6; width stops before the stamp box (x 400)
      { key: "idPlace", x: 213, y: 645.3, w: 180, size: 12 },
      { key: "idDate", x: 213, y: 661.1, w: 180, size: 12 },
      { key: "orNumber", x: 213, y: 676.6, w: 180, size: 12 },
    ],
    stamp: { x: 400, y: 628, w: 180, h: 56 },
  },
  utility: {
    id: "utility",
    documentCode: "UTILITY_CLEARANCE",
    paperSize: "short",
    paper,
    fields: [
      date(233),
      { key: "name", x: 207, y: 373.8, w: 330 },
      { key: "address", x: 207, y: 392.8, w: 330 },
      { key: "location", x: 207, y: 451.8, w: 330 },
      { key: "idNumber", x: 213, y: 629, w: 180 }, // colons at x 201.6; width stops before the stamp box (x 400)
      { key: "idPlace", x: 213, y: 645, w: 180 },
      { key: "idDate", x: 213, y: 661, w: 180 },
      { key: "orNumber", x: 213, y: 677, w: 180 },
    ],
    stamp: { x: 400, y: 627, w: 180, h: 56 },
    // Centres of the small pre-printed squares (7.8 x 7 pt). A mark is printed only in the chosen square.
    marks: [
      { key: "electric", when: "yes", x: 216.7, y: 345.7 },
      { key: "water", when: "yes", x: 330.1, y: 345.7 },
      { key: "connectionType", when: "New", x: 221.4, y: 419.1 },
      { key: "connectionType", when: "Reconnection", x: 330.1, y: 416.8 },
      { key: "classification", when: "Residential", x: 221.4, y: 435.6 },
      { key: "classification", when: "Commercial", x: 330.1, y: 435.6 },
    ],
  },
  indigency: {
    id: "indigency",
    documentCode: "INDIGENCY",
    paperSize: "short",
    paper,
    fields: [
      date(220),
      { key: "name", x: 135, y: 343.6, w: 400 },
      { key: "address", x: 135, y: 362.6, w: 400 },
      { key: "age", x: 135, y: 382.6 },
      // "SECTOR :" is NOT pre-printed (docs/04 4.2): the print builder supplies `sectorLabel` and `sectorColon` (label font, 1.2 pt lower than the value) and `sector` (value font).
      { key: "sectorLabel", x: 51, y: 403.2, font: "label" },
      { key: "sectorColon", x: 123.5, y: 403.2, font: "label" },
      { key: "sector", x: 135, y: 402, w: 400 },
      { key: "purpose", x: 135, y: 479.6, w: 400 },
      {
        key: "addressedTo",
        prefix: "Addressed to the office of ",
        font: "note",
        size: 10,
        x: 135,
        y: 498,
        w: 400,
      },
    ],
  },
  // Page 2 of Barangay_Certification_of_Marginalized_Sector.docx (Certification for assistance request). The health condition is stored but not printed: the form has no line for it.
  assistance: {
    id: "assistance",
    documentCode: "ASSISTANCE",
    paperSize: "short",
    paper,
    fields: [
      { key: "name", x: 203, y: 201.6, w: 165, page: 1 },
      { key: "address", x: 123, y: 226.6, w: 160, page: 1 },
      { key: "years", x: 495, y: 226.6, w: 14, page: 1 },
      { key: "sector", x: 222, y: 300.6, w: 200, page: 1 },
      { key: "relationship", x: 74, y: 400.6, w: 175, page: 1 },
      { key: "underName", x: 340, y: 400.6, w: 190, page: 1 },
      { key: "day", x: 174, y: 523.6, w: 36, align: "center", page: 1 },
      { key: "month", x: 227, y: 523.6, w: 130, page: 1 },
    ],
    // The sample .docx has "(X)" pre-typed on financial and oneself; blank stock must show "( )" for these marks.
    marks: [
      { key: "assistanceType", when: "Financial", x: 379.5, y: 357.7, page: 1 },
      { key: "assistanceType", when: "Medical", x: 445, y: 357.7, page: 1 },
      { key: "assistanceType", when: "Burial", x: 502, y: 357.7, page: 1 },
      { key: "for", when: "Myself", x: 395.5, y: 383.2, page: 1 },
      { key: "for", when: "Someone else", x: 469, y: 383.2, page: 1 },
    ],
  },
  // Certification of Residency, from the blank copy of the barangay's Word file (scripts/make-blank-print-sources.py). The signatory has no line on the form: the typed name and position go in the space above the CTC rows.
  residency: {
    id: "residency",
    documentCode: "RESIDENCY",
    paperSize: "short",
    paper,
    blankStock: true,
    fields: [
      { key: "name", x: 285, y: 198.1, w: 164 },
      { key: "address", x: 90, y: 230.3, w: 228 },
      { key: "since", x: 259.4, y: 246.4, w: 68, align: "center" },
      ...statementLines(),
      { key: "purpose", x: 184, y: 391.8, w: 176 },
      { key: "dayOrdinal", x: 194, y: 423.0, w: 34, align: "center" },
      { key: "month", x: 325, y: 423.0, w: 130, align: "center" },
      { key: "yearShort", x: 423, y: 423.0, w: 24, align: "center" },
      { key: "signatoryName", x: 430, y: 476.0, w: 230, align: "center" },
      {
        key: "signatoryPosition",
        x: 430,
        y: 490,
        w: 230,
        align: "center",
        size: 10,
      },
      { key: "idPresented", x: 226, y: 516.8, w: 156, size: 10 },
      { key: "orNumber", x: 226, y: 528.9, w: 156, size: 10 },
      { key: "date", x: 226, y: 540.9, w: 156, size: 10 },
    ],
  },
  // First-Time Jobseeker packet on 8.5 x 13 in: page 0 Applicant sheet, page 1 Oath of Undertaking, page 2 Certification. The witness name and the Date line print as in the barangay's filled certifications (decision 118, patch 340; it replaces the old rule that the witness is never printed); the signature and thumbmark stay blank, and the applicant photo prints under the signature as in the barangay's Word file (patch 341) when the resident has one on file. `y` = rule y minus 10.2 pt, as the other values on these sheets; rule positions measured on jobseeker-1.png and jobseeker-2.png.
  jobseeker: {
    id: "jobseeker",
    documentCode: "FIRST_TIME_JOBSEEKER",
    paperSize: "long",
    paper: longPaper,
    blankStock: true,
    // Every Jobseeker value is Verdana Bold, the font of the barangay's Word file (patch 344); Cambria looked small beside the Verdana form text.
    fields: ([
      { key: "name", x: 118, y: 210.3, w: 326, size: 11 },
      { key: "birthdate", x: 152, y: 237.5, w: 186, size: 11 },
      { key: "ageNumber", x: 395, y: 237.5, w: 78, size: 11 },
      ...addressLines(),
      { key: "yearsResident", x: 378, y: 346.3, w: 126, size: 11 },
      { key: "sex", x: 153, y: 373.5, w: 94, size: 11 },
      { key: "civilStatus", x: 326, y: 373.5, w: 140, size: 11 },
      { key: "educationalAttainment", x: 222, y: 400.7, w: 243, size: 11 },
      { key: "course", x: 252, y: 427.9, w: 220, size: 11 },
      { key: "name", x: 88, y: 122.2, w: 250, size: 11, page: 1 },
      {
        key: "ageNumber",
        x: 351,
        y: 122.2,
        w: 34,
        align: "left",
        size: 11,
        page: 1,
      },
      { key: "yearsResident", x: 343, y: 136.9, w: 120, size: 11, page: 1 },
      {
        key: "dayOrdinal",
        x: 155.5,
        y: 586.3,
        w: 30,
        align: "center",
        size: 11,
        page: 1,
      },
      {
        key: "month",
        x: 279,
        y: 586.3,
        w: 120,
        align: "center",
        size: 11,
        page: 1,
      },
      {
        key: "yearShort",
        x: 370,
        y: 586.3,
        w: 16,
        align: "center",
        size: 11,
        page: 1,
      },
      { key: "name", x: 241, y: 231.2, w: 163, size: 11, page: 2 },
      { key: "yearsResident", x: 269, y: 250.4, w: 110, size: 11, page: 2 },
      {
        key: "dayOrdinal",
        x: 173.5,
        y: 418.6,
        w: 44,
        align: "center",
        size: 11,
        page: 2,
      },
      {
        key: "month",
        x: 322,
        y: 418.6,
        w: 124,
        align: "center",
        size: 11,
        page: 2,
      },
      {
        key: "yearShort",
        x: 421,
        y: 418.6,
        w: 16,
        align: "center",
        size: 11,
        page: 2,
      },
      // Oath: the witness name sits on the rule after "Witnessed by:" (rule y 697.5, x 320.4-528.8, redrawn in patch 345 to be as wide and as centred as the label under it, as in the Word file where name, designation and label share one centre line, x 424.6); the Date follows the pre-printed "Date:" (rule y 763.7, x 105.5-259.6).
      {
        key: "witnessName",
        x: 424.6,
        y: 687.3,
        w: 206,
        align: "center",
        size: 11,
        page: 1,
      },
      // Designation of the witness, between the rule and "Barangay Official/Designation/Position" (label y 731.9-742.3).
      {
        key: "witnessDesignation",
        x: 424.6,
        y: 716,
        w: 206,
        align: "center",
        size: 11,
        page: 1,
      },
      { key: "date", x: 108, y: 753.5, w: 148, size: 11, page: 1 },
      // Certification: the witness name sits on the rule under "Witnessed by:" (rule y 679.1, x 310.0-518.4, redrawn in patch 345 to centre on the label, x 414.2); the Date follows the pre-printed "Date:" (rule y 759.2, x 338.8-493.2; the label and Date rows were moved down 14 pt in jobseeker-2.png, patch 343, to make room for the designation line as in the barangay's Word file).
      {
        key: "witnessName",
        x: 414.2,
        y: 668.9,
        w: 206,
        align: "center",
        size: 11,
        page: 2,
      },
      // Designation of the witness, between the rule (y 679.0) and the label, now at y 704.8-715.3.
      {
        key: "witnessDesignation",
        x: 414.2,
        y: 690,
        w: 206,
        align: "center",
        size: 11,
        page: 2,
      },
      { key: "date", x: 342, y: 749.2, w: 148, size: 11, page: 2 },
      {
        key: "signatoryName",
        x: 430,
        y: 588,
        w: 230,
        align: "center",
        size: 11,
        page: 2,
      },
      {
        key: "signatoryPosition",
        x: 430,
        y: 602,
        w: 230,
        align: "center",
        size: 11,
        page: 2,
      },
    ] as PrintFieldBox[]).map((field) => ({
      ...field,
      y: Math.round((field.y - JOBSEEKER_LIFT) * 10) / 10,
      font: "form" as const,
    })),
    // Centres of the two check boxes on the applicant sheet; an X goes only in the chosen one.
    marks: [
      { key: "jobstart", when: "yes", x: 295.7, y: 558.5 },
      { key: "jobstart", when: "no", x: 403.5, y: 558.5 },
    ],
    // Applicant photo: in the barangay's Word file it sits under "Signature of Applicant", left-aligned with the text block; x/y/w/h are the picture's visible edges measured on a 200 dpi render of that file (x 107.6-254.5, y 692.6-847.8). The form has no pre-printed box, so the photo is cropped to fill this one.
    photo: { x: 107.6, y: 692.6, w: 146.9, h: 155.2 },
  },
}
