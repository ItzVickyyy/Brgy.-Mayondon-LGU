import { expect, test } from "@playwright/test"
import { documentMeta } from "../src/components/Issuances/config"
import { overlayCss, printOverlayCss } from "../src/lib/print/overlayStyles"
import { pageRule, paperDimensions } from "../src/lib/print/paperSizes"
import { printTemplates } from "../src/lib/print/templates"

const shortDocuments = [
  "Barangay Clearance",
  "Barangay Franchise Clearance",
  "Barangay Clearance, Electrical and Water Connection",
  "Certification of Residency",
  "Certificate of Indigency",
  "Certification (assistance request)",
]

test.describe("paper sizes (Short = 8.5 x 11 in, Long = 8.5 x 13 in)", () => {
  test("Short is Letter and Long is 8.5 x 13 in, not US Legal", () => {
    expect(paperDimensions.short).toMatchObject({
      widthPt: 612,
      heightPt: 792,
      css: "8.5in 11in",
    })
    expect(paperDimensions.long).toMatchObject({
      widthPt: 612,
      heightPt: 936,
      css: "8.5in 13in",
    })
    expect(paperDimensions.long.heightPt).toBe(13 * 72)
  })

  test("the seven Short documents and the one Long document", () => {
    for (const name of shortDocuments)
      expect(documentMeta[name].paper.size, name).toBe("short")
    expect(documentMeta["First-Time Jobseeker Certification"].paper.size).toBe(
      "long",
    )
    expect(Object.keys(documentMeta)).toHaveLength(shortDocuments.length + 1)
  })

  test("every print template with a layout today is Short, 612 x 792 pt", () => {
    for (const template of Object.values(printTemplates)) {
      expect(template.paperSize, template.id).toBe("short")
      expect(template.paper).toEqual({ widthPt: 612, heightPt: 792 })
    }
  })

  test("the page rule and the overlay stylesheet follow the size", () => {
    expect(pageRule("short")).toBe("@page { size: 8.5in 11in; margin: 0 }")
    expect(pageRule("long")).toBe("@page { size: 8.5in 13in; margin: 0 }")
    expect(overlayCss("short")).toContain("height: 792pt")
    expect(overlayCss("long")).toContain(
      "@page { size: 8.5in 13in; margin: 0 }",
    )
    expect(overlayCss("long")).toContain("height: 936pt")
    expect(overlayCss("long")).not.toContain("792pt")
    expect(printOverlayCss).toBe(overlayCss("short"))
  })
})
