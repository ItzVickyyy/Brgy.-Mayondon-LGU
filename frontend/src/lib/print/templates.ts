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
export type PrintTemplate = {
  id: PrintTemplateId
  documentCode: string
  paperSize: PaperSize
  paper: { widthPt: number; heightPt: number }
  fields: PrintFieldBox[]
  marks?: PrintMarkBox[]
  photo?: PrintPhotoBox
}
export type PrintTemplateId =
  | "clearance"
  | "franchise"
  | "utility"
  | "indigency"
  | "marginalized"
  | "assistance"

// Every template with a print layout today is a Short (Letter) document. A Long template adds `paperSize: "long"`.
const paper = {
  widthPt: paperDimensions.short.widthPt,
  heightPt: paperDimensions.short.heightPt,
}
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
      { key: "name", x: 135, y: 322.7, w: 255 },
      { key: "address", x: 135, y: 341.7, w: 255 },
      { key: "age", x: 135, y: 361.7 },
      { key: "birthdate", x: 135, y: 380.7 },
      { key: "birthplace", x: 135, y: 400.7, w: 255 },
      { key: "civilStatus", x: 135, y: 419.7 },
      { key: "purpose", x: 135, y: 458.7, w: 255 },
      { key: "remarks", x: 135, y: 497.7, w: 320 },
      // Bottom block: values go right of the colons at x 230.6 (measured on the page image of the barangay form).
      { key: "idType", x: 243, y: 613.4, w: 250 },
      { key: "idNumber", x: 243, y: 631.4, w: 250 },
      { key: "idPlace", x: 243, y: 648.4, w: 250 },
      { key: "idDate", x: 243, y: 665.4, w: 250 },
      { key: "orNumber", x: 243, y: 683.4, w: 250 },
    ],
    photo: { x: 402, y: 340, w: 82, h: 79 }, // inside the pre-printed photo box (x 400.8-485.4, y 339-420.7) so its border stays visible; thumbmark box and signature line stay blank
  },
  franchise: {
    id: "franchise",
    documentCode: "FRANCHISE_CLEARANCE",
    paperSize: "short",
    paper,
    fields: [
      date(210),
      { key: "name", x: 207, y: 332.9, w: 330 },
      { key: "address", x: 207, y: 352.9, w: 330 },
      { key: "association", x: 207, y: 371.9, w: 330 },
      { key: "make", x: 207, y: 407.9 },
      { key: "bodyType", x: 207, y: 426.9 },
      { key: "motorNumber", x: 207, y: 445.9 },
      { key: "color", x: 207, y: 465.9 },
      { key: "plateNumber", x: 207, y: 484.9 },
      { key: "idNumber", x: 213, y: 630, w: 250 }, // colons at x 200.8
      { key: "idPlace", x: 213, y: 646, w: 250 },
      { key: "idDate", x: 213, y: 662, w: 250 },
      { key: "orNumber", x: 213, y: 678, w: 250 },
    ],
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
      { key: "idNumber", x: 213, y: 629, w: 250 }, // colons at x 200.8
      { key: "idPlace", x: 213, y: 645, w: 250 },
      { key: "idDate", x: 213, y: 661, w: 250 },
      { key: "orNumber", x: 213, y: 677, w: 250 },
    ],
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
      // "SECTOR :" is NOT pre-printed (docs/04 4.2): the print builder must supply the label in `sectorLine`.
      { key: "sectorLine", x: 50, y: 402, w: 480 },
      { key: "purpose", x: 135, y: 479.6, w: 400 },
      {
        key: "addressedTo",
        prefix: "Addressed to the office of: ",
        x: 135,
        y: 498,
        w: 400,
      },
    ],
  },
  // Page 1 of Barangay_Certification_of_Marginalized_Sector.docx (Pagpapatunay). Blanks sit in justified text, so x is approximate.
  marginalized: {
    id: "marginalized",
    documentCode: "MARGINALIZED_SECTOR",
    paperSize: "short",
    paper,
    fields: [
      { key: "name", x: 261, y: 231.2, w: 190 },
      { key: "address", x: 74, y: 274.4, w: 240 },
      { key: "sector", x: 131, y: 318, w: 215 },
      { key: "name", x: 294, y: 361.5, w: 200 },
      { key: "healthCondition", x: 181, y: 405.1, w: 200 },
      { key: "day", x: 240, y: 457, w: 22, align: "center" },
      { key: "month", x: 273, y: 457, w: 125 },
    ],
  },
  // Page 2 of the same file (Certification for assistance request).
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
}
