import type { CSSProperties, ReactNode } from "react"
import { createPortal } from "react-dom"
import type { PrintData } from "@/lib/print/buildPrintData"

/**
 * Full one-page forms for blank paper ("form and data" print mode).
 * Wording is copied from docs/reference/document-templates/*.docx. Signatures, the thumbmark
 * and the dry seal are never filled in: the thumbmark box and the "DRY SEAL" caption are only
 * markers for staff.
 */
export const printFormCss = `
@page { size: letter; margin: 0 }
.print-form-root { display: none }
.print-form-root[data-preview="true"] { display: block; position: fixed; inset: 0; z-index: 9999; overflow: auto; background: #888; padding: 16px }
.pf-page { position: relative; width: 612pt; height: 792pt; overflow: hidden; background: #fff; margin: 0 auto 16px; box-sizing: border-box;
  padding: 36pt 48pt 30pt; font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.25; color: #000;
  display: flex; flex-direction: column; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.pf-page > * { position: relative; z-index: 1 }
.pf-mark { position: absolute !important; z-index: 0 !important; left: 156pt; top: 250pt; width: 300pt; opacity: .07; pointer-events: none }
.pf-head { display: flex; align-items: center; gap: 12pt; text-align: center; border-bottom: 2pt solid #000; padding-bottom: 6pt }
.pf-head img { width: 62pt; height: 62pt; object-fit: contain }
.pf-head div { flex: 1; padding-right: 62pt }
.pf-head p { margin: 0; font-size: 10pt }
.pf-head .pf-brgy { font-size: 16pt; font-weight: 700; letter-spacing: .5pt }
.pf-head .pf-office { font-weight: 700 }
.pf-head .pf-contact { font-size: 8.5pt }
.pf-title { text-align: center; font-weight: 700; font-size: 15pt; margin: 14pt 0 2pt; letter-spacing: 1pt }
.pf-sub { text-align: center; font-weight: 700; font-size: 11pt; margin: 0 0 4pt }
.pf-date { text-align: right; margin: 4pt 0 10pt }
.pf-date span { display: inline-block; min-width: 150pt; border-bottom: 1pt solid #000; text-align: center; padding: 0 4pt }
.pf-date small { display: block; text-align: center; font-size: 8pt; margin-right: 0 }
.pf-body { text-align: justify; text-indent: 28pt; margin: 6pt 0 10pt }
.pf-row { display: flex; align-items: flex-end; gap: 6pt; margin: 5pt 0 }
.pf-row b { flex: none; min-width: 108pt; font-weight: 700 }
.pf-row .pf-val { flex: 1; min-width: 0; border-bottom: 1pt solid #000; padding: 0 3pt; min-height: 14pt; overflow-wrap: anywhere }
.pf-split { display: flex; gap: 14pt; align-items: flex-start }
.pf-split > .pf-left { flex: 1; min-width: 0 }
.pf-box { flex: none; width: 84pt; text-align: center; font-size: 7.5pt; font-weight: 700 }
.pf-box i { display: flex; align-items: center; justify-content: center; width: 84pt; height: 81pt; border: 1pt solid #000; margin-bottom: 2pt; overflow: hidden; font-style: normal }
.pf-box img { width: 100%; height: 100%; object-fit: cover }
.pf-sig { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 18pt }
.pf-sig > div { text-align: center; font-weight: 700; min-width: 170pt }
.pf-sig .pf-line { border-top: 1pt solid #000; margin-top: 30pt; padding-top: 2pt }
.pf-sig small { display: block; font-weight: 400; font-size: 9pt }
.pf-seal { font-size: 9pt; font-weight: 700; border: 1pt dashed #000; padding: 22pt 14pt }
.pf-foot { margin-top: 14pt; border-top: 1pt solid #000; padding-top: 6pt }
.pf-note { font-size: 8.5pt; font-style: italic; margin-top: 6pt }
.pf-check { display: inline-block; text-indent: 0; width: 12pt; text-align: center; border: 1pt solid #000; line-height: 10pt; font-weight: 700; font-size: 9pt; margin: 0 3pt 0 6pt; vertical-align: -1pt }
.pf-fill { display: inline-block; text-indent: 0; min-width: 40pt; border-bottom: 1pt solid #000; text-align: center; padding: 0 3pt; font-weight: 700 }
.pf-center-title { text-align: center; font-weight: 700; font-size: 15pt; letter-spacing: 2pt; margin: 6pt 0 14pt }
.pf-para { text-align: left; text-indent: 28pt; margin: 0 0 10pt; line-height: 1.6 }
@media print {
  html, body { margin: 0 !important; padding: 0 !important }
  body > *:not(.print-form-root) { display: none !important }
  .print-form-root, .print-form-root * { visibility: visible !important }
  .print-form-root, .print-form-root[data-preview="true"] { display: block !important; position: static; padding: 0; background: none; overflow: visible }
  .pf-page { margin: 0; break-after: page; break-inside: avoid }
  .pf-page:last-child { break-after: auto }
}
`

const LOGO = "/assets/images/Barangay Mayondon Logo.png"
type Values = Record<string, string>
const v = (values: Values, key: string) => values[key] ?? ""

function Letterhead({ contact }: { contact: string }) {
  return (
    <header className="pf-head">
      <img src={LOGO} alt="" />
      <div>
        <p>Republic of the Philippines</p>
        <p>Province of Laguna</p>
        <p>Municipality of Los Baños</p>
        <p className="pf-brgy">BARANGAY MAYONDON</p>
        <p className="pf-office">OFFICE OF THE PUNONG BARANGAY</p>
        <p className="pf-contact">{contact}</p>
      </div>
    </header>
  )
}

function Row({
  label,
  value,
  style,
}: {
  label: string
  value: string
  style?: CSSProperties
}) {
  return (
    <div className="pf-row" style={style}>
      <b>{label}</b>
      <span className="pf-val">{value}</span>
    </div>
  )
}

function DateLine({ value }: { value: string }) {
  return (
    <div className="pf-date">
      <span>{value}</span>
      <small>Date</small>
    </div>
  )
}

function Check({ on }: { on: boolean }) {
  return <span className="pf-check">{on ? "X" : " "}</span>
}

function Signatory({ name, position }: { name: string; position: string }) {
  return (
    <div>
      <div className="pf-line">
        {name}
        <small>{position}</small>
      </div>
    </div>
  )
}

function Payment({ values, id }: { values: Values; id: string }) {
  return (
    <div className="pf-foot">
      <Row label={`${id} Number:`} value={v(values, "idNumber")} />
      <Row label="Place of Issue:" value={v(values, "idPlace")} />
      <Row label="Date of Issue:" value={v(values, "idDate")} />
      <Row
        label="Paid under OFFICIAL RECEIPT No.:"
        value={v(values, "orNumber")}
      />
    </div>
  )
}

function Clearance({ data }: { data: PrintData }) {
  const x = data.values
  return (
    <>
      <Letterhead contact="Telephone No.: (049) 502-2443   Gmail Address: lgudonmayon@gmail.com.ph" />
      <h1 className="pf-title">BARANGAY CLEARANCE</h1>
      <DateLine value={v(x, "date")} />
      <p className="pf-body">
        This is to certify that the person whose name, picture and right
        thumbprint appear hereunder has passed the record verification conducted
        by this barangay. The results of which are listed below:
      </p>
      <div className="pf-split">
        <div className="pf-left">
          <Row label="NAME:" value={v(x, "name")} />
          <Row label="ADDRESS:" value={v(x, "address")} />
          <Row label="AGE:" value={v(x, "age")} />
          <Row label="BIRTHDATE:" value={v(x, "birthdate")} />
          <Row label="BIRTHPLACE:" value={v(x, "birthplace")} />
          <Row label="CIVIL STATUS:" value={v(x, "civilStatus")} />
        </div>
        <div className="pf-box">
          <i>{data.photoUrl ? <img src={data.photoUrl} alt="" /> : "PHOTO"}</i>
          <div style={{ marginTop: 6 }}>
            <i style={{ height: 60 }}>{" "}</i>
            RIGHT THUMBMARK
          </div>
        </div>
      </div>
      <Row label="PURPOSE:" value={v(x, "purpose")} />
      <Row label="REMARKS:" value={v(x, "remarks")} />
      <div className="pf-sig">
        <div className="pf-seal">DRY SEAL</div>
        <Signatory
          name="HON. DANILO V. APOLINARIO"
          position="PUNONG BARANGAY"
        />
      </div>
      <div className="pf-foot">
        <Row label="Valid I.D. Presented:" value={v(x, "idType")} />
        <Row label="Number:" value={v(x, "idNumber")} />
        <Row label="Place of Issue:" value={v(x, "idPlace")} />
        <Row label="Date of Issue:" value={v(x, "idDate")} />
        <Row
          label="Paid under OFFICIAL RECEIPT No.:"
          value={v(x, "orNumber")}
        />
        <p className="pf-note">
          Not valid if with erasures, any mark of alterations and without dry
          seal. Valid for only two (2) months upon date issued
        </p>
      </div>
    </>
  )
}

function Franchise({ data }: { data: PrintData }) {
  const x = data.values
  return (
    <>
      <Letterhead contact="Telephone No.: (049) 502-2443   Email Address: barangay_mayondon@yahoo.com.ph" />
      <h1 className="pf-title">BARANGAY FRANCHISE CLEARANCE</h1>
      <DateLine value={v(x, "date")} />
      <p className="pf-body">
        This is to certify that this office interposes no objection to the
        proposed construction of building as specified hereunder:
      </p>
      <Row label="NAME:" value={v(x, "name")} />
      <Row label="ADDRESS:" value={v(x, "address")} />
      <Row label="TRICYCLE ASSOCIATION:" value={v(x, "association")} />
      <Row label="MAKE:" value={v(x, "make")} />
      <Row label="TYPE OF BODY:" value={v(x, "bodyType")} />
      <Row label="MOTOR NO:" value={v(x, "motorNumber")} />
      <Row label="COLOR:" value={v(x, "color")} />
      <Row label="PLATE NUMBER:" value={v(x, "plateNumber")} />
      <div className="pf-sig">
        <div className="pf-seal">DRY SEAL</div>
        <Signatory
          name="HON. DANILO V. APOLINARIO"
          position="PUNONG BARANGAY"
        />
      </div>
      <Payment values={x} id="CTC" />
      <p className="pf-note">
        Not valid if with erasures, any mark of alterations and without dry
        seal.
      </p>
    </>
  )
}

function Utility({ data }: { data: PrintData }) {
  const x = data.values
  return (
    <>
      <Letterhead contact="Telephone No.: (049) 502-2443   Email Address: barangay_mayondon@yahoo.com.ph" />
      <h1 className="pf-title" style={{ marginBottom: 0 }}>
        BARANGAY CLEARANCE
      </h1>
      <p className="pf-sub">Electrical and Water Connection</p>
      <DateLine value={v(x, "date")} />
      <p className="pf-body">
        This is to certify that this office interposes no objection to the
        application for installation of electrical/water meter connection as
        stated hereunder:
      </p>
      <p style={{ margin: "0 0 4pt", fontWeight: 700 }}>
        <Check on={v(x, "electric") === "yes"} />
        ELECTRIC
        <Check on={v(x, "water") === "yes"} />
        WATER
      </p>
      <Row label="NAME:" value={v(x, "name")} />
      <Row label="ADDRESS:" value={v(x, "address")} />
      <p style={{ margin: "7pt 0", fontWeight: 700 }}>
        TYPE OF CONNECTION:
        <Check on={v(x, "connectionType") === "New"} />
        New
        <Check on={v(x, "connectionType") === "Reconnection"} />
        Reconnection
      </p>
      <p style={{ margin: "7pt 0", fontWeight: 700 }}>
        CLASSIFICATION:
        <Check on={v(x, "classification") === "Residential"} />
        Residential
        <Check on={v(x, "classification") === "Commercial"} />
        Commercial
      </p>
      <Row label="LOCATION:" value={v(x, "location")} />
      <div className="pf-sig">
        <div className="pf-seal">DRY SEAL</div>
        <Signatory
          name="HON. DANILO V. APOLINARIO"
          position="PUNONG BARANGAY"
        />
      </div>
      <Payment values={x} id="CTC" />
      <p className="pf-note">
        Not valid if with erasures, any mark of alterations and without dry
        seal.
      </p>
    </>
  )
}

function Indigency({ data }: { data: PrintData }) {
  const x = data.values
  return (
    <>
      <Letterhead contact="Telephone No.: (049) 502-2443   Gmail Address: lgudonmayon@gmail.com.ph" />
      <h1 className="pf-title">CERTIFICATE OF INDIGENCY</h1>
      <DateLine value={v(x, "date")} />
      <p className="pf-body">
        This is to certify that the person whose name, age and address appear
        hereunder has no fixed income and belongs to marginalized family in this
        barangay.
      </p>
      <Row label="NAME:" value={v(x, "name")} />
      <Row label="ADDRESS:" value={v(x, "address")} />
      <Row label="AGE:" value={v(x, "age")} />
      <p
        style={{
          margin: "6pt 0",
          fontWeight: 700,
          minHeight: "14pt",
          borderBottom: "1pt solid #000",
          padding: "0 3pt",
        }}
      >
        {v(x, "sectorLine")}
      </p>
      <Row label="PURPOSE:" value={v(x, "purpose")} />
      <Row
        label="Addressed to the office of:"
        value={v(x, "addressedTo")}
        style={{ marginTop: 8 }}
      />
      <div className="pf-sig">
        <div className="pf-seal">DRY SEAL</div>
        <Signatory
          name="HON. DANILO V. APOLINARIO"
          position="Punong Barangay"
        />
      </div>
      <p className="pf-note">
        Not valid if with erasures, any mark of alterations and without dry
        seal.
      </p>
    </>
  )
}

function Marginalized({ data }: { data: PrintData }) {
  const x = data.values
  return (
    <>
      <Letterhead contact="Telephone No.: (049) 502-2443   Gmail Address: lgudonmayon@gmail.com" />
      <h1 className="pf-center-title" style={{ marginTop: 24 }}>
        PAGPAPATUNAY
      </h1>
      <p style={{ margin: "0 0 14pt" }}>Sa Kinauukulan:</p>
      <p className="pf-para">
        Ito ay nagpapatunay na si{" "}
        <span className="pf-fill">{v(x, "name")}</span>, may sapat ang gulang
        naninirahan at may pahatirang sulat{" "}
        <span className="pf-fill">{v(x, "address")}</span>, Mayondon, Los Baños
        Laguna ay nabibilang sa Marginalized Sector sa aming barangay. Siya ay
        pumapailalim sa sector ng{" "}
        <span className="pf-fill">{v(x, "sector")}</span>.
      </p>
      <p className="pf-para">
        Pagpapatunay na si <span className="pf-fill">{v(x, "name")}</span> ay
        nangangailangan ng tulong medical o pinansiyal dahil sa kanyang
        kondisyong pangkalusugan na{" "}
        <span className="pf-fill">{v(x, "healthCondition")}</span>.
      </p>
      <p className="pf-para">
        Ginawa ngayong ika-
        <span className="pf-fill" style={{ minWidth: 24 }}>
          {v(x, "day")}
        </span>{" "}
        ng{" "}
        <span className="pf-fill" style={{ minWidth: 110 }}>
          {v(x, "month")}
        </span>
        .
      </p>
      <div className="pf-sig">
        <div className="pf-seal">DRY SEAL</div>
        <Signatory name="HON. DANILO V. APOLINARIO" position="BRGY. KAGAWAD" />
      </div>
    </>
  )
}

function Assistance({ data }: { data: PrintData }) {
  const x = data.values
  const type = v(x, "assistanceType")
  const forSelf = v(x, "for") === "Myself"
  const other = v(x, "for") === "Someone else"
  return (
    <>
      <Letterhead contact="Telephone No.: (049) 502-2443   Gmail Address: lgudonmayon@gmail.com" />
      <h1 className="pf-center-title" style={{ marginTop: 24 }}>
        CERTIFICATION
      </h1>
      <p className="pf-para">
        This is to certify that Mr./Ms.{" "}
        <span className="pf-fill" style={{ minWidth: 130 }}>
          {v(x, "name")}
        </span>
        , Filipino and of legal age, is a bonafide resident of{" "}
        <span className="pf-fill" style={{ minWidth: 130 }}>
          {v(x, "address")}
        </span>
        , Mayondon, Los Baños, Laguna for a period of{" "}
        <span className="pf-fill" style={{ minWidth: 22 }}>
          {v(x, "years")}
        </span>{" "}
        years.
      </p>
      <p className="pf-para">
        This is further certify that the above mentioned named individual
        belongs to the indigent community of this Barangay and is a member of
        the{" "}
        <span className="pf-fill" style={{ minWidth: 150 }}>
          {v(x, "sector")}
        </span>{" "}
        sector.
      </p>
      <p className="pf-para">
        This certification is being issued for the purpose of requesting for
        <Check on={type === "Financial"} />
        financial
        <Check on={type === "Medical"} />
        medical
        <Check on={type === "Burial"} />
        burial assistance from the Municipal Government of Los Baños for
        <Check on={forSelf} />
        oneself /<Check on={other} />
        his or her{" "}
        <span className="pf-fill" style={{ minWidth: 100 }}>
          {v(x, "relationship")}
        </span>{" "}
        under the name of{" "}
        <span className="pf-fill" style={{ minWidth: 130 }}>
          {v(x, "underName")}
        </span>
        .
      </p>
      <p className="pf-para">
        Under penalty of perjury and other applicable laws, I hereby certify
        that the above information provided herein are true and correct.
      </p>
      <p className="pf-para">
        Given this{" "}
        <span className="pf-fill" style={{ minWidth: 30 }}>
          {v(x, "day")}
        </span>{" "}
        day of{" "}
        <span className="pf-fill" style={{ minWidth: 110 }}>
          {v(x, "month")}
        </span>
        .
      </p>
      <div className="pf-sig">
        <div className="pf-seal">DRY SEAL</div>
        <Signatory
          name="HON. MIGUEL CHRISTIAN O. CONCIO"
          position="BARANGAY KAGAWAD"
        />
      </div>
    </>
  )
}

const forms: Record<
  PrintData["templateId"],
  (props: { data: PrintData }) => ReactNode
> = {
  clearance: Clearance,
  franchise: Franchise,
  utility: Utility,
  indigency: Indigency,
  marginalized: Marginalized,
  assistance: Assistance,
}

type Props = {
  data: PrintData
  preview?: boolean // show on screen for checking; never used for real printing
}

/** Renders the typeset form for `data` into document.body. Call `window.print()` while it is mounted. */
export function PrintForm({ data, preview = false }: Props) {
  const Form = forms[data.templateId]
  return createPortal(
    <div className="print-form-root" data-preview={preview}>
      <style>{printFormCss}</style>
      <div className="pf-page">
        <img className="pf-mark" src={LOGO} alt="" />
        <Form data={data} />
      </div>
    </div>,
    document.body,
  )
}
