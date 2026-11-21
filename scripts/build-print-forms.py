#!/usr/bin/env python3
"""
Builds the page images for the "form and data" print from the barangay's own blank forms.

The barangay's Word files are the template. Word itself must export them to PDF (File > Save as > PDF), so the layout is
exactly what Word shows; a different program lays the text out differently and would not be the same form.
Residency and First-Time Jobseeker are not pre-printed stock: use the blank copies from scripts/make-blank-print-sources.py.

Input folder, BLANK forms only (no resident data on any page):
  clearance.pdf, franchise.pdf, utility.pdf, indigency.pdf   one page each, Letter
  marginalized-assistance.pdf                                 page 1 = PAGPAPATUNAY (retired, not printed), page 2 = CERTIFICATION; both blank
  residency.pdf                                               one page, Letter (from Barangay-Certification-of-Residency-BLANK.docx)
  first-time-jobseeker.pdf                                    three pages, 612 x 936 pt = Long, 8.5 x 13 in: Applicant sheet, Oath, Certification
                                                              (from Barangay-Certification-of-First-Time-Jobseekers-BLANK.docx; made by scripts/make-blank-print-sources.py)

Usage (needs poppler: pdftoppm, pdfinfo, pdftotext):
  python3 scripts/build-print-forms.py <folder-with-pdfs> [--dpi 200]
  python3 scripts/build-print-forms.py <folder-with-pdfs> --words indigency   # list words with x, y in pt, to re-check templates.ts

Writes frontend/public/assets/print-forms/<id>-<sheet>.png and frontend/src/lib/print/formBackgrounds.ts.
Never edits the Word files. Forms whose PDF is missing keep the typeset copy.
"""
import argparse, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_IMG = os.path.join(ROOT, "frontend", "public", "assets", "print-forms")
OUT_TS = os.path.join(ROOT, "frontend", "src", "lib", "print", "formBackgrounds.ts")

# Paper sizes in pt: Short = Letter, Long = 8.5 x 13 in (frontend/src/lib/print/paperSizes.ts is the single source in the app).
SHORT = (612, 792)
LONG = (612, 936)

# template id -> (pdf file, expected page count, {sheet index used by templates.ts: pdf page number})
SPEC = {
    "clearance": ("clearance.pdf", 1, {0: 1}),
    "franchise": ("franchise.pdf", 1, {0: 1}),
    "utility": ("utility.pdf", 1, {0: 1}),
    "indigency": ("indigency.pdf", 1, {0: 1}),
    "assistance": ("marginalized-assistance.pdf", 2, {1: 2}),
    "residency": ("residency.pdf", 1, {0: 1}),
    "jobseeker": ("first-time-jobseeker.pdf", 3, {0: 1, 1: 2, 2: 3}),
}
# Every form is Short unless listed here.
PAPER = {"jobseeker": LONG}


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def info(pdf):
    out = run(["pdfinfo", pdf])
    pages = int(re.search(r"Pages:\s+(\d+)", out).group(1))
    size = re.search(r"Page size:\s+([\d.]+) x ([\d.]+) pts", out)
    return pages, float(size.group(1)), float(size.group(2))


def words(pdf, page):
    xml = run(["pdftotext", "-f", str(page), "-l", str(page), "-bbox", pdf, "-"])
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', xml):
        yield float(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4)), m.group(5)


def existing_manifest():
    """The entries of the current formBackgrounds.ts, so a run with only some PDFs does not drop the other forms."""
    if not os.path.exists(OUT_TS):
        return {}
    with open(OUT_TS, encoding="utf8") as f:
        text = f.read()
    manifest = {}
    for m in re.finditer(r"^  (\w+): \[(.*)\],$", text, flags=re.M):
        manifest[m.group(1)] = re.findall(r'"([^"]*)"', m.group(2))
    return manifest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--words", metavar="ID")
    a = ap.parse_args()

    if a.words:
        pdf, _, pages = SPEC[a.words]
        for sheet, page in pages.items():
            print(f"-- {a.words} sheet {sheet} (pdf page {page}): x1 y1 x2 y2 word, in pt from the top-left")
            for x1, y1, x2, y2, w in words(os.path.join(a.folder, pdf), page):
                print(f"{x1:7.1f} {y1:7.1f} {x2:7.1f} {y2:7.1f} {w}")
        return

    os.makedirs(OUT_IMG, exist_ok=True)
    manifest = existing_manifest()  # forms whose PDF is not in the folder keep their current entry
    problems = []
    for tid, (name, expected, pages) in SPEC.items():
        pdf = os.path.join(a.folder, name)
        if not os.path.exists(pdf):
            print(f"skip   {tid}: {name} not found (keeps the typeset copy)")
            continue
        n, w, h = info(pdf)
        want_w, want_h = PAPER.get(tid, SHORT)
        if abs(w - want_w) > 1 or abs(h - want_h) > 1:
            kind = "Long (8.5 x 13 in)" if (want_w, want_h) == LONG else "Letter"
            problems.append(f"{tid}: {name} is {w:.0f} x {h:.0f} pt, not {kind} ({want_w} x {want_h}); export it from Word on that paper size")
            continue
        if n != expected:
            problems.append(f"{tid}: {name} has {n} page(s), expected {expected}; keep only the blank sheet(s) when exporting")
            continue
        urls = [""] * (max(pages) + 1)
        for sheet, page in pages.items():
            base = os.path.join(OUT_IMG, f"{tid}-{sheet}")
            run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(a.dpi), "-png", "-singlefile", pdf, base])
            urls[sheet] = f"/assets/print-forms/{tid}-{sheet}.png"
            print(f"ok     {tid}: sheet {sheet} from {name} page {page} -> {os.path.basename(base)}.png")
        manifest[tid] = urls
    for p in problems:
        print("ERROR ", p)

    manifest = {tid: manifest[tid] for tid in sorted(manifest, key=lambda t: list(SPEC).index(t) if t in SPEC else 99)}
    lines = [
        "/**",
        " * The barangay's own blank forms, one page image per sheet (\"form and data\" print mode).",
        " * Generated by `scripts/build-print-forms.py` from the Word files the barangay supplied, exported to PDF by Word itself.",
        " * A form that is not listed here is printed from the typeset copy in PrintForm.tsx instead.",
        " * Do not edit by hand. Images live in `public/assets/print-forms/`. An empty entry means the sheet is not part of that form.",
        " */",
        'import type { PrintTemplateId } from "./templates"',
        "",
        "export const formBackgrounds: Partial<Record<PrintTemplateId, string[]>> = {",
    ]
    for tid, urls in manifest.items():
        lines.append(f"  {tid}: [" + ", ".join(f'"{u}"' for u in urls) + "],")
    lines.append("}")
    with open(OUT_TS, "w", encoding="utf8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {os.path.relpath(OUT_TS, ROOT)} ({len(manifest)} form(s))")
    sys.exit(1 if problems else 0)


main()
