// Unit tests for the Save as PDF / Save as Word file builders (pure, no browser pages).
import { expect, test } from "@playwright/test"
import {
  buildDocx,
  buildPdf,
  buildZip,
  exportMime,
  type SheetImage,
  safeFileName,
} from "../src/lib/print/exportDocument"

const sheet = (): SheetImage => ({
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  widthPx: 1275,
  heightPx: 1650,
})

const text = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes)

/** Reads the stored entries of a .zip from its central directory. */
function zipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = bytes.length - 22
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--
  expect(eocd).toBeGreaterThanOrEqual(0)
  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  const entries: { name: string; data: Uint8Array }[] = []
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const local = view.getUint32(at + 42, true)
    const name = text(bytes.slice(at + 46, at + 46 + nameLength))
    const dataAt =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true)
    entries.push({ name, data: bytes.slice(dataAt, dataAt + size) })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

test.describe("PDF", () => {
  test("is a well-formed file with one page per sheet at the paper size", () => {
    const pdf = text(buildPdf([sheet(), sheet(), sheet()], 612, 936, "Test"))
    expect(pdf.startsWith("%PDF-")).toBe(true)
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true)
    expect(pdf).toContain("/Count 3")
    expect(pdf.match(/\/MediaBox \[0 0 612 936\]/g)).toHaveLength(3)
    const startxref = Number(/startxref\s+(\d+)/.exec(pdf)?.[1])
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref")
  })

  test("keeps awkward characters in the title from breaking the file", () => {
    const pdf = text(buildPdf([sheet()], 612, 792, "A (b) \\ ñ"))
    expect(pdf).toContain("/MediaBox [0 0 612 792]")
    expect(pdf).not.toContain("ñ")
  })
})

test.describe("Word file (zip)", () => {
  test("zip keeps names and bytes", () => {
    const entries = [
      { name: "a.txt", data: new Uint8Array([1, 2, 3]) },
      { name: "dir/b.bin", data: new Uint8Array([9, 8]) },
    ]
    const read = zipEntries(buildZip(entries))
    expect(read.map((e) => e.name)).toEqual(["a.txt", "dir/b.bin"])
    expect(Array.from(read[1].data)).toEqual([9, 8])
  })

  test("docx holds the required parts, one picture per sheet and the paper size", () => {
    const docx = buildDocx([sheet(), sheet()], 612, 936, "Test")
    expect(text(docx.slice(0, 2))).toBe("PK")
    const parts = zipEntries(docx)
    const names = parts.map((part) => part.name)
    expect(names).toContain("[Content_Types].xml")
    expect(names).toContain("word/document.xml")
    expect(names.filter((name) => name.startsWith("word/media/"))).toHaveLength(
      2,
    )
    const body = text(
      parts.find((part) => part.name === "word/document.xml")?.data ??
        new Uint8Array(),
    )
    expect(body).toContain('w:w="12240"') // 612 pt in twips
    expect(body).toContain('w:h="18720"') // 936 pt in twips
  })
})

test.describe("names and types", () => {
  test("safe file names", () => {
    expect(safeFileName("Peña / Juan: Clearance", "pdf")).toBe(
      "Pena Juan Clearance.pdf",
    )
    expect(safeFileName("???", "docx")).toBe("document.docx")
    expect(safeFileName("x".repeat(200), "pdf").length).toBe(84)
  })

  test("mime types", () => {
    expect(exportMime.pdf).toBe("application/pdf")
    expect(exportMime.docx).toContain("wordprocessingml")
  })
})
