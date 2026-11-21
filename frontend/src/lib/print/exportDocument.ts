/**
 * Builds a .pdf or .docx file from finished page images. Pure functions: no DOM, no network, no libraries.
 * The pages come from `renderSheets.ts` (the barangay's blank form with the typed values on it), so the saved
 * file looks like the printed one. Each page is an image the size of the paper (612 x 792 pt Short, 612 x 936 pt Long).
 */

export type ExportFormat = "pdf" | "docx"

export type SheetImage = {
  /** JPEG bytes (used by the PDF). */
  jpeg: Uint8Array
  /** PNG bytes (used by the Word file). */
  png: Uint8Array
  /** Pixel size of both images. */
  widthPx: number
  heightPx: number
}

const encoder = new TextEncoder()
const ascii = (text: string) => encoder.encode(text)

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  )
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

/** Characters a PDF literal string or an XML text cannot hold safely. */
const pdfText = (value: string) =>
  value.replace(/[^\x20-\x7e]/g, "?").replace(/([()\\])/g, "\\$1")
const xmlText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/** One PDF page per sheet: the page image fills the paper. */
export function buildPdf(
  sheets: SheetImage[],
  widthPt: number,
  heightPt: number,
  title: string,
): Uint8Array {
  // Object numbers: 1 catalog, 2 page tree, 3 info, then three per sheet (page, content, image).
  const objects: Uint8Array[] = []
  const add = (number: number, body: Uint8Array[]) => {
    objects[number - 1] = concat([
      ascii(`${number} 0 obj\n`),
      ...body,
      ascii("\nendobj\n"),
    ])
  }
  const pageNumber = (index: number) => 4 + index * 3
  add(1, [ascii("<< /Type /Catalog /Pages 2 0 R >>")])
  add(2, [
    ascii(
      `<< /Type /Pages /Count ${sheets.length} /Kids [${sheets.map((_, index) => `${pageNumber(index)} 0 R`).join(" ")}] >>`,
    ),
  ])
  add(3, [
    ascii(`<< /Title (${pdfText(title)}) /Producer (Barangay Mayondon LGU) >>`),
  ])
  sheets.forEach((sheet, index) => {
    const page = pageNumber(index)
    const content = ascii(`q ${widthPt} 0 0 ${heightPt} 0 0 cm /Im0 Do Q`)
    add(page, [
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`,
      ),
    ])
    add(page + 1, [
      ascii(`<< /Length ${content.length} >>\nstream\n`),
      content,
      ascii("\nendstream"),
    ])
    add(page + 2, [
      ascii(
        `<< /Type /XObject /Subtype /Image /Width ${sheet.widthPx} /Height ${sheet.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${sheet.jpeg.length} >>\nstream\n`,
      ),
      sheet.jpeg,
      ascii("\nendstream"),
    ])
  })

  const header = ascii("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
  const parts: Uint8Array[] = [header]
  const offsets: number[] = []
  let at = header.length
  for (const object of objects) {
    offsets.push(at)
    parts.push(object)
    at += object.length
  }
  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`]
  for (const offset of offsets)
    xref.push(`${String(offset).padStart(10, "0")} 00000 n \n`)
  xref.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${at}\n%%EOF\n`,
  )
  parts.push(ascii(xref.join("")))
  return concat(parts)
}

let crcTable: Uint32Array | undefined
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1)
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const byte of bytes)
    crc = (crcTable[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

type ZipEntry = { name: string; data: Uint8Array }

/** A .zip without compression ("stored"): Word accepts it, and the PNG pages are compressed already. */
export function buildZip(entries: ZipEntry[], now = new Date()): Uint8Array {
  const time =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const date =
    ((Math.max(now.getFullYear(), 1980) - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = ascii(entry.name)
    const crc = crc32(entry.data)
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true) // version needed
    head.setUint16(6, 0x0800, true) // names are UTF-8
    head.setUint16(8, 0, true) // stored
    head.setUint16(10, time, true)
    head.setUint16(12, date, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, entry.data.length, true)
    head.setUint32(22, entry.data.length, true)
    head.setUint16(26, name.length, true)
    head.setUint16(28, 0, true)
    const record = concat([new Uint8Array(head.buffer), name, entry.data])
    local.push(record)
    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, 0, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, date, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, entry.data.length, true)
    dir.setUint32(24, entry.data.length, true)
    dir.setUint16(28, name.length, true)
    dir.setUint32(42, offset, true)
    central.push(concat([new Uint8Array(dir.buffer), name]))
    offset += record.length
  }
  const centralBytes = concat(central)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralBytes.length, true)
  end.setUint32(16, offset, true)
  return concat([...local, centralBytes, new Uint8Array(end.buffer)])
}

const EMU_PER_PT = 12700
const TWIPS_PER_PT = 20

/**
 * A Word file with one page image behind the text of each page, placed exactly on the paper corner
 * (an anchored picture, not text), so the page keeps its size and does not spill into an extra blank page.
 */
export function buildDocx(
  sheets: SheetImage[],
  widthPt: number,
  heightPt: number,
  title: string,
): Uint8Array {
  const cx = widthPt * EMU_PER_PT
  const cy = heightPt * EMU_PER_PT
  const paragraphs = sheets
    .map((_, index) => {
      const id = index + 1
      return (
        `<w:p><w:pPr>${index ? "<w:pageBreakBefore/>" : ""}<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:drawing>` +
        `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${id}" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">` +
        `<wp:simplePos x="0" y="0"/>` +
        `<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>` +
        `<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>` +
        `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
        `<wp:docPr id="${id}" name="Page ${id}" descr="${xmlText(`${title}, page ${id}`)}"/>` +
        `<wp:cNvGraphicFramePr/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="page${id}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="rId${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
        `</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`
      )
    })
    .join("")
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<w:body>${paragraphs}<w:sectPr><w:pgSz w:w="${widthPt * TWIPS_PER_PT}" w:h="${heightPt * TWIPS_PER_PT}"/>` +
    `<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const relationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${index + 1}.png"/>`,
    )
    .join("")
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: ascii(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: ascii(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
    },
    { name: "word/document.xml", data: ascii(documentXml) },
    {
      name: "word/_rels/document.xml.rels",
      data: ascii(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
      ),
    },
    ...sheets.map((sheet, index) => ({
      name: `word/media/page${index + 1}.png`,
      data: sheet.png,
    })),
  ])
}

export const exportMime: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

/** A file name that is safe on Windows: letters, digits, dots, dashes and spaces only. */
export function safeFileName(base: string, format: ExportFormat): string {
  const clean = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // "ñ" becomes "n", not "n " with a gap
    .replace(/[^\w .-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return `${clean || "document"}.${format}`
}
