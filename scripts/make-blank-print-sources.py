#!/usr/bin/env python3
"""
Makes BLANK copies of the two barangay forms that are not pre-printed stock: Certification of Residency and
First-Time Jobseekers. The result is what `build-print-forms.py` turns into page images, and what the
barangay can open in Word to export the same pages from Word itself.

Why a script: the supplied Word files are working files. The Residency file holds hundreds of finished certificates with real names,
and both files carry a real signature and a real photo. The blank copies keep only the barangay's letterhead, footer and
fixed wording. Nothing else is copied: the body of the Residency form is written here, and every picture that is not the
barangay seal is dropped. Standard library only; the originals are never changed.

Usage:
  python3 scripts/make-blank-print-sources.py [--out docs/Barangay-softcopies/blank]

Writes Barangay-Certification-of-Residency-BLANK.docx and Barangay-Certification-of-First-Time-Jobseekers-BLANK.docx.
Fixed here on purpose (typos on the supplied form): "BIRTDATE", "ceretify", "certifiy". The Jobseeker page is 8.5 x 13 in
(the app's Long paper, frontend/src/lib/print/paperSizes.ts), not the 8.5 x 14 in of the supplied file.
"""
import argparse
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "Barangay-softcopies")
RESIDENCY = "Barangay-Certification-of-Residency.docx"
JOBSEEKER = "Barangay-Certification-of-First-Time-Jobseekers.docx"
LONG_HEIGHT_TWIPS = 18720  # 13 in


def split_body(xml):
    start = xml.index("<w:body>") + len("<w:body>")
    sect = xml.rindex("<w:sectPr")
    end = xml.rindex("</w:body>")
    return xml[:start], xml[start:sect], xml[sect:end], xml[end:]


def paragraphs(body):
    return re.findall(r"<w:p[ >].*?</w:p>", body, flags=re.S)


def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def ppr(paragraph):
    match = re.search(r"<w:pPr>.*?</w:pPr>", paragraph, flags=re.S)
    return match.group(0) if match else ""


def first_rpr(paragraph):
    match = re.search(r"<w:r[ >].*?(<w:rPr>.*?</w:rPr>)", paragraph, flags=re.S)
    return match.group(1) if match else ""


def rewrite(paragraph, lines, bold=False):
    """The paragraph with the same paragraph and character formatting and only `lines` as text (one run, a line break between lines)."""
    rpr = first_rpr(paragraph)
    if bold and "<w:b/>" not in rpr:
        rpr = rpr.replace("<w:rPr>", "<w:rPr><w:b/>", 1)
    parts = []
    for index, line in enumerate(lines):
        if index:
            parts.append("<w:br/>")
        parts.append(f'<w:t xml:space="preserve">{esc(line)}</w:t>')
    head = re.match(r"<w:p[^>]*>", paragraph).group(0)
    return f"{head}{ppr(paragraph)}<w:r>{rpr}{''.join(parts)}</w:r></w:p>"


def replace_in_text(paragraph, old, new):
    if old not in paragraph:
        sys.exit(f"expected text not found: {old!r}")
    return paragraph.replace(old, new, 1)


def drop_drawings(paragraph):
    return re.sub(r"<w:r[ >](?:(?!</w:r>).)*?<w:drawing>.*?</w:r>", "", paragraph, flags=re.S)


def write_docx(source, target, document_xml, keep_media):
    with zipfile.ZipFile(source) as zin, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            name = item.filename
            if name.startswith("word/media/") and name not in keep_media:
                continue
            data = zin.read(name)
            if name == "word/document.xml":
                data = document_xml.encode("utf8")
            if name == "word/_rels/document.xml.rels":
                text = data.decode("utf8")
                for rel in re.findall(r"<Relationship [^>]*/>", text):
                    target_match = re.search(r'Target="(media/[^"]+)"', rel)
                    if target_match and f"word/{target_match.group(1)}" not in keep_media:
                        text = text.replace(rel, "")
                data = text.encode("utf8")
            zout.writestr(item, data)


def build_residency(out):
    source = os.path.join(SRC, RESIDENCY)
    with zipfile.ZipFile(source) as z:
        xml = z.read("word/document.xml").decode("utf8")
    head, body, sect, tail = split_body(xml)
    p = paragraphs(body)
    title, whom, text_p, footer_p = p[0], p[2], p[4], p[16]
    empty = re.sub(r"<w:r[ >].*</w:r>", "", p[3], flags=re.S)
    line = "______________________________"

    def text(*lines, indent=True):
        out = rewrite(text_p, list(lines)).replace('<w:jc w:val="both"/>', '<w:jc w:val="left"/>')  # fixed line breaks: no stretched lines
        return out if indent else out.replace('<w:ind w:firstLine="720"/>', "")

    def row(label):
        tabs = '<w:tabs><w:tab w:val="left" w:pos="2900"/></w:tabs>'
        pr = ppr(footer_p).replace("<w:pPr>", "<w:pPr>" + tabs, 1)
        rpr = first_rpr(footer_p)
        head_tag = re.match(r"<w:p[^>]*>", footer_p).group(0)
        return (f'{head_tag}{pr}<w:r>{rpr}<w:t>{esc(label)}</w:t><w:tab/>'
                f'<w:t xml:space="preserve">: ____________________________________</w:t></w:r></w:p>')

    new_body = [
        title,
        empty,
        whom,
        empty,
        text(
            "This is to certify that Mr./Ms. ____________________________",
            "is a registered resident of this barangay with postal address",
            "at ______________________________________, Mayondon,",
            "Los Baños, Laguna since ____________ up to present.",
        ),
        empty,
        # Room for the optional additional statement (up to 500 characters, typed in six lines; no ruled lines).
        *[empty] * 6,
        text(
            "This certification is issued upon the request of the above-",
            "named person for ______________________________ purposes.",
        ),
        empty,
        text("Issued this ______ day of ______________________, 20____."),
        *[empty] * 5,
        row("CTC number/ID presented"),
        row("Paid under OR number"),
        row("Date issued"),
    ]
    document = head + "".join(new_body) + sect + tail
    keep = {"word/media/image4.png"}  # the seal in the header
    write_docx(source, out, document, keep)


def build_jobseeker(out):
    source = os.path.join(SRC, JOBSEEKER)
    with zipfile.ZipFile(source) as z:
        xml = z.read("word/document.xml").decode("utf8")
    head, body, sect, tail = split_body(xml)
    # Text boxes hold paragraphs of their own, so work with positions in the XML and only edit top-level paragraphs.
    spans = [match.span() for match in re.finditer(r"<w:p[ >].*?</w:p>", body, flags=re.S)]
    frag = [body[a:b] for a, b in spans]
    edits = {}
    edits[25] = drop_drawings(frag[25])  # a signature picture
    for index in (1, 8, 9):  # the form says BIRTDATE
        edits[index] = frag[index].replace("BIRTDATE", "BIRTHDATE")
    edits[29] = replace_in_text(frag[29], " for ______________ (years/months),", " for ______________________,")
    edits[41] = rewrite(frag[41], ["Signed this ______ day of ______________________, 20___, in the Barangay Mayondon, Los Baños, Laguna."])
    edits[50] = replace_in_text(frag[50], "MARK DENNIS A. CONCIO", "_______________________")
    edits[51] = replace_in_text(replace_in_text(frag[51], "BRGY.", ""), "CLERK", "")
    edits[53] = rewrite(frag[53], ["Date: ____________________________"])
    edits[72] = frag[72].replace("ceretify", "certify")
    edits[72] = replace_in_text(edits[72], "Laguna for ________ ", "Laguna for ____________________")
    edits[72] = replace_in_text(edits[72], ">years<", "><").replace("/months, is a", ", is a")
    edits[74] = frag[74].replace("certifiy", "certify")
    edits[82] = replace_in_text(replace_in_text(frag[82], "ON. ", ""), "DANILO V. APOLINARIO", "")
    edits[82] = edits[82].replace("<w:t>H</w:t>", "<w:t></w:t>")
    edits[83] = replace_in_text(replace_in_text(frag[83], "Punong ", ""), "Barangay", "")
    # The picture that used to push the Oath onto page 2 is gone, so start each sheet on its own page.
    for index in (27, 56):
        fragment = edits.get(index, frag[index])
        edits[index] = fragment.replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>", 1) if "<w:pPr>" in fragment else fragment
    # The blank packet is the first 98 fragments (Applicant sheet, Oath, Certification); the rest of the file is finished certificates.
    # Empty spacer paragraphs on the Oath sheet go, so the whole Oath (with the Date line) fits one 13 in sheet.
    for index in (43, 44, 45, 48, 49, 54, 55, 91, 92, 93, 94, 95, 96, 97):
        edits[index] = ""
    cut = spans[98][0]
    out_body, last = [], 0
    for index in sorted(edits):
        a, b = spans[index]
        out_body.append(body[last:a])
        out_body.append(edits[index])
        last = b
    out_body.append(body[last:cut])
    document = head + "".join(out_body) + sect.replace('w:h="20160"', f'w:h="{LONG_HEIGHT_TWIPS}"') + tail
    keep = {"word/media/image1.jpeg"}  # the seal on the certification sheet
    write_docx(source, out, document, keep)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.path.join(SRC, "blank"))
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    build_residency(os.path.join(args.out, "Barangay-Certification-of-Residency-BLANK.docx"))
    build_jobseeker(os.path.join(args.out, "Barangay-Certification-of-First-Time-Jobseekers-BLANK.docx"))
    print("wrote", os.path.relpath(args.out, ROOT))


main()
