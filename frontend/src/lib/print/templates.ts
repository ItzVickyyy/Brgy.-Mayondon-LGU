/**
 * Print overlay templates (one per pre-printed form). Data only, no rendering.
 *
 * Units are PostScript points (1/72 in) from the TOP-LEFT of a US Letter page (612 x 792),
 * measured from a LibreOffice render of docs/reference/document-templates/*.docx (page 1 unless
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
  paper: { widthPt: 612; heightPt: 792 }
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

const paper = { widthPt: 612, heightPt: 792 } as const
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
    paper,
    fields: [
      date(199),
      { key: "name", x: 135, y: 320, w: 255 },
      { key: "address", x: 135, y: 339, w: 255 },
      { key: "age", x: 135, y: 359 },
      { key: "birthdate", x: 135, y: 378 },
      { key: "birthplace", x: 135, y: 398, w: 255 },
      { key: "civilStatus", x: 135, y: 417 },
      { key: "purpose", x: 135, y: 456, w: 255 },
      { key: "remarks", x: 135, y: 495, w: 320 },
      // Bottom block is on page 2 in the LibreOffice render; 17 pt steps are estimated. Calibrate.
      { key: "idType", x: 243, y: 686, w: 250 },
      { key: "idNumber", x: 243, y: 703, w: 250 },
      { key: "idPlace", x: 243, y: 720, w: 250 },
      { key: "idDate", x: 243, y: 737, w: 250 },
      { key: "orNumber", x: 243, y: 754, w: 250 },
    ],
    photo: { x: 401, y: 339, w: 84, h: 81 }, // thumbmark box (x 490-570) and signature line stay blank
  },
  franchise: {
    id: "franchise",
    documentCode: "FRANCHISE_CLEARANCE",
    paper,
    fields: [
      date(210),
      { key: "name", x: 207, y: 330, w: 330 },
      { key: "address", x: 207, y: 350, w: 330 },
      { key: "association", x: 207, y: 369, w: 330 },
      { key: "make", x: 207, y: 405 },
      { key: "bodyType", x: 207, y: 424 },
      { key: "motorNumber", x: 207, y: 443 },
      { key: "color", x: 207, y: 463 },
      { key: "plateNumber", x: 207, y: 482 },
      { key: "idNumber", x: 213, y: 713, w: 250 },
      { key: "idPlace", x: 213, y: 729, w: 250 },
      { key: "idDate", x: 213, y: 745, w: 250 },
      { key: "orNumber", x: 213, y: 762, w: 250 },
    ],
  },
  utility: {
    id: "utility",
    documentCode: "UTILITY_CLEARANCE",
    paper,
    fields: [
      date(233),
      { key: "name", x: 207, y: 371, w: 330 },
      { key: "address", x: 207, y: 390, w: 330 },
      { key: "location", x: 207, y: 468, w: 330 },
      { key: "idNumber", x: 213, y: 707, w: 250 },
      { key: "idPlace", x: 213, y: 723, w: 250 },
      { key: "idDate", x: 213, y: 739, w: 250 },
      { key: "orNumber", x: 213, y: 756, w: 250 },
    ],
    // Centres of the small pre-printed squares (7.8 x 7 pt). A mark is printed only in the chosen square.
    marks: [
      { key: "electric", when: "yes", x: 216.9, y: 344.7 },
      { key: "water", when: "yes", x: 330.1, y: 344.7 },
      { key: "connectionType", when: "New", x: 221.4, y: 438 },
      { key: "connectionType", when: "Reconnection", x: 330.1, y: 435.7 },
      { key: "classification", when: "Residential", x: 221.4, y: 454.3 },
      { key: "classification", when: "Commercial", x: 330.1, y: 454.5 },
    ],
  },
  indigency: {
    id: "indigency",
    documentCode: "INDIGENCY",
    paper,
    fields: [
      date(220),
      { key: "name", x: 135, y: 341, w: 400 },
      { key: "address", x: 135, y: 360, w: 400 },
      { key: "age", x: 135, y: 380 },
      // "SECTOR :" is NOT pre-printed (docs/04 4.2): the print builder must supply the label in `sectorLine`.
      { key: "sectorLine", x: 50, y: 399, w: 480 },
      { key: "purpose", x: 135, y: 477, w: 400 },
      { key: "addressedTo", x: 135, y: 496, w: 400 },
    ],
  },
  // Page 1 of Barangay_Certification_of_Marginalized_Sector.docx (Pagpapatunay). Blanks sit in justified text, so x is approximate.
  marginalized: {
    id: "marginalized",
    documentCode: "MARGINALIZED_SECTOR",
    paper,
    fields: [
      { key: "name", x: 261, y: 229, w: 190 },
      { key: "address", x: 74, y: 273, w: 240 },
      { key: "sector", x: 131, y: 316, w: 215 },
      { key: "name", x: 294, y: 360, w: 200 },
      { key: "healthCondition", x: 181, y: 403, w: 200 },
      { key: "day", x: 240, y: 457, w: 22, align: "center" },
      { key: "month", x: 273, y: 457, w: 125 },
    ],
  },
  // Page 2 of the same file (Certification for assistance request).
  assistance: {
    id: "assistance",
    documentCode: "ASSISTANCE",
    paper,
    fields: [
      { key: "name", x: 203, y: 200, w: 165, page: 1 },
      { key: "address", x: 123, y: 225, w: 165, page: 1 },
      { key: "years", x: 495, y: 225, w: 14, page: 1 },
      { key: "sector", x: 222, y: 299, w: 200, page: 1 },
      { key: "relationship", x: 74, y: 399, w: 175, page: 1 },
      { key: "underName", x: 340, y: 399, w: 190, page: 1 },
      { key: "day", x: 174, y: 522, w: 36, align: "center", page: 1 },
      { key: "month", x: 227, y: 522, w: 130, page: 1 },
    ],
    // The sample .docx has "(X)" pre-typed on financial and oneself; blank stock must show "( )" for these marks.
    marks: [
      { key: "assistanceType", when: "Financial", x: 379.5, y: 356, page: 1 },
      { key: "assistanceType", when: "Medical", x: 445, y: 356, page: 1 },
      { key: "assistanceType", when: "Burial", x: 502, y: 356, page: 1 },
      { key: "for", when: "Myself", x: 395.5, y: 381.5, page: 1 },
      { key: "for", when: "Someone else", x: 469, y: 381.5, page: 1 },
    ],
  },
}
