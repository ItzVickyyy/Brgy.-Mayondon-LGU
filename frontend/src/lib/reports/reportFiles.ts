/**
 * Saves a Management Report as Excel, Word, PDF or CSV. Pure functions, no libraries: every format is built
 * from the same grid of rows the CSV uses (first row = column headings, English), so the files always agree.
 */
import { buildZip } from "@/lib/print/exportDocument"

export type ReportFormat = "xlsx" | "docx" | "pdf" | "csv"

export type ReportCell = string | number
export type ReportTable = {
  title: string
  subtitle: string
  rows: ReportCell[][]
}

export const reportMime: Record<ReportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  csv: "text/csv;charset=utf-8;",
}

const encoder = new TextEncoder()
const utf8 = (text: string) => encoder.encode(text)

// biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 cannot hold these characters
const NOT_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g
const xml = (value: string) =>
  value
    .replace(NOT_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export function reportCsv(rows: ReportCell[][]): string {
  return rows
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n")
}

/** Column letters: 0 -> A, 25 -> Z, 26 -> AA. */
function columnName(index: number): string {
  let name = ""
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    name = String.fromCharCode(65 + (n % 26)) + name
  }
  return name
}

export function buildReportXlsx(table: ReportTable): Uint8Array {
  const widths: number[] = []
  for (const row of table.rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(
        widths[index] ?? 8,
        Math.min(String(cell).length + 2, 60),
      )
    })
  }
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("")
  const sheetRows = table.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`
          const style = rowIndex === 0 ? ' s="1"' : ""
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}"${style}><v>${cell}</v></c>`
          }
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(String(cell))}</t></is></c>`
        })
        .join("")
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join("")
  const sheet = `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`
  const styles = `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  const sheetName = xml(
    table.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Report",
  )
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: utf8(
        `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: utf8(
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: utf8(
        `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: utf8(
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: "xl/styles.xml", data: utf8(styles) },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheet) },
  ])
}

/** Many columns need a landscape page; both Word and PDF use the same rule. */
const isWide = (table: ReportTable) => (table.rows[0]?.length ?? 0) >= 7

export function buildReportDocx(table: ReportTable): Uint8Array {
  const wide = isWide(table)
  const pageW = wide ? 15840 : 12240
  const pageH = wide ? 12240 : 15840
  const margin = 1080
  const columns = table.rows[0]?.length ?? 1
  const inner = pageW - margin * 2
  const colW = Math.floor(inner / columns)
  const border =
    '<w:tcBorders><w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/></w:tcBorders>'
  const cell = (value: ReportCell, header: boolean, last: boolean) => {
    const numeric = typeof value === "number"
    const shade = header
      ? '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>'
      : ""
    const run = `<w:r><w:rPr>${header || last ? "<w:b/>" : ""}<w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xml(String(value))}</w:t></w:r>`
    return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${border}${shade}</w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${numeric ? '<w:jc w:val="right"/>' : ""}</w:pPr>${run}</w:p></w:tc>`
  }
  const lastIndex = table.rows.length - 1
  const rows = table.rows
    .map((row, index) => {
      const header = index === 0
      const total = index === lastIndex && /^total/i.test(String(row[0] ?? ""))
      return `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${row.map((value) => cell(value, header, total)).join("")}</w:tr>`
    })
    .join("")
  const grid = Array.from(
    { length: columns },
    () => `<w:gridCol w:w="${colW}"/>`,
  ).join("")
  const body = `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">${xml(table.title)}</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xml(table.subtitle)}</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="${colW * columns}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl><w:sectPr><w:pgSz w:w="${pageW}" w:h="${pageH}"${wide ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: utf8(
        `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: utf8(
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
    },
    {
      name: "word/document.xml",
      data: utf8(
        `${XML_HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
      ),
    },
  ])
}

// ---- PDF: Helvetica text table, Windows-1252 letters (Latin names such as "Peña" print correctly) ----

/** Rough Helvetica widths in em, enough to wrap text inside a column without overflowing. */
function charWidth(ch: string): number {
  if ("iljtfI.,;:'|! ".includes(ch)) return 0.3
  if ("mwMW".includes(ch)) return 0.85
  if (ch >= "A" && ch <= "Z") return 0.68
  return 0.56
}
const textWidth = (text: string, size: number) =>
  [...text].reduce((sum, ch) => sum + charWidth(ch), 0) * size

function wrap(text: string, width: number, size: number): string[] {
  const lines: string[] = []
  let line = ""
  const push = (word: string) => {
    if (textWidth(word, size) > width) {
      // A single word wider than the column is cut into pieces.
      for (const ch of word) {
        if (textWidth(line + ch, size) > width && line) {
          lines.push(line)
          line = ""
        }
        line += ch
      }
      return
    }
    const next = line ? `${line} ${word}` : word
    if (textWidth(next, size) > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  for (const word of text.split(/\s+/).filter(Boolean)) push(word)
  if (line || lines.length === 0) lines.push(line)
  return lines
}

/** A PDF literal string in WinAnsi: letters up to U+00FF are kept, anything else becomes "?". */
function pdfString(text: string): string {
  let out = ""
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`
    else if (code >= 0x20 && code <= 0x7e) out += ch
    else if (code >= 0xa0 && code <= 0xff)
      out += `\\${code.toString(8).padStart(3, "0")}`
    else out += "?"
  }
  return out
}

export function buildReportPdf(table: ReportTable): Uint8Array {
  const wide = isWide(table)
  const pageW = wide ? 792 : 612
  const pageH = wide ? 612 : 792
  const margin = 43
  const size = 9
  const lead = 12
  const pad = 4
  const columns = table.rows[0]?.length ?? 1
  const inner = pageW - margin * 2
  // Column widths follow the longest text in each column, within limits.
  // A heading word must never be cut in two, so each column is at least as wide as its longest
  // heading word (bold text is wider, hence the 1.3).
  const weights = Array.from({ length: columns }, (_, c) => {
    const headWord = Math.max(
      ...String(table.rows[0]?.[c] ?? "")
        .split(/\s+/)
        .map((word) => word.length),
    )
    const longest = Math.max(
      ...table.rows.map((row) => String(row[c] ?? "").length),
    )
    return Math.max(6, headWord * 1.3 + 1, Math.min(40, longest))
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  const colW = weights.map((weight) => (weight / sum) * inner)

  const pages: string[] = []
  let ops: string[] = []
  let y = pageH - margin
  const startPage = (first: boolean) => {
    ops = []
    y = pageH - margin
    if (first) {
      ops.push(
        `BT /F2 15 Tf ${margin} ${y - 12} Td (${pdfString(table.title)}) Tj ET`,
      )
      y -= 22
      ops.push(
        `BT /F1 9 Tf 0.33 g ${margin} ${y - 9} Td (${pdfString(table.subtitle)}) Tj ET 0 g`,
      )
      y -= 24
    }
  }
  const endPage = () => pages.push(ops.join("\n"))
  const drawRow = (row: ReportCell[], header: boolean, bold: boolean) => {
    const cells = row.map((value, c) =>
      wrap(String(value), (colW[c] ?? 40) - pad * 2, size),
    )
    const height =
      Math.max(...cells.map((lines) => lines.length)) * lead + pad * 2 - 2
    if (y - height < margin + 18) {
      endPage()
      startPage(false)
      drawRow(table.rows[0] ?? [], true, true)
    }
    let x = margin
    cells.forEach((lines, c) => {
      const w = colW[c] ?? 40
      if (header)
        ops.push(`0.85 0.89 0.95 rg ${x} ${y - height} ${w} ${height} re f 0 g`)
      ops.push(`0.6 G 0.5 w ${x} ${y - height} ${w} ${height} re S`)
      const numeric = typeof row[c] === "number"
      lines.forEach((line, i) => {
        const at = numeric ? x + w - pad - textWidth(line, size) : x + pad
        ops.push(
          `BT /${header || bold ? "F2" : "F1"} ${size} Tf ${at.toFixed(1)} ${(y - pad - size - i * lead + 1).toFixed(1)} Td (${pdfString(line)}) Tj ET`,
        )
      })
      x += w
    })
    y -= height
  }
  startPage(true)
  table.rows.forEach((row, index) => {
    const total =
      index === table.rows.length - 1 && /^total/i.test(String(row[0] ?? ""))
    drawRow(row, index === 0, total)
  })
  endPage()

  // Page numbers, then the objects: 1 catalog, 2 pages, 3 info, 4-5 fonts, then page + content per page.
  const objects: string[] = []
  const pageIds = pages.map((_, i) => 6 + i * 2)
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>"
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  objects[2] = `<< /Title (${pdfString(table.title)}) /Producer (Barangay Mayondon LGU) >>`
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  pages.forEach((content, i) => {
    const footer = `BT /F1 8 Tf 0.4 g ${pageW / 2 - 20} 24 Td (Page ${i + 1} of ${pages.length}) Tj ET`
    const stream = `${content}\n${footer}`
    const id = pageIds[i] as number
    objects[id - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${id + 1} 0 R >>`
    objects[id] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const at = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets)
    out += `${String(offset).padStart(10, "0")} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${at}\n%%EOF\n`
  // Every character is ASCII (high letters are octal escapes), so one byte per character.
  return Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff)
}

export function buildReportFile(
  format: ReportFormat,
  table: ReportTable,
): Uint8Array {
  if (format === "xlsx") return buildReportXlsx(table)
  if (format === "docx") return buildReportDocx(table)
  if (format === "pdf") return buildReportPdf(table)
  return utf8(reportCsv(table.rows))
}
