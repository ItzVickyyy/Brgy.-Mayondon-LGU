import type { ReactNode } from "react"

import { barangayProfile } from "@/config/barangay-profile"

// The logo is the same file the printed certificates use.
const LOGO = "/assets/images/Barangay Mayondon Logo.png"

/**
 * Official heading of a printed Management Report: the barangay letterhead
 * (as on the Barangay softcopies), then the report title and what it covers.
 * Shown on paper only. Styles live in index.css under `.report-sheet`.
 */
export function ReportLetterhead({
  title,
  subtitle,
  coverage,
  printedOn,
}: {
  title: string
  subtitle: string
  coverage: string
  printedOn: string
}) {
  const [country, region, province, municipality, barangay, office] =
    barangayProfile.headerLines
  return (
    <header className="report-letterhead hidden print:block">
      <div className="report-letterhead__top">
        <img src={LOGO} alt="" />
        <div className="report-letterhead__lines">
          <p>{country}</p>
          <p>{region}</p>
          <p>{province}</p>
          <p>{municipality}</p>
          <p className="report-letterhead__barangay">{barangay}</p>
          <p className="report-letterhead__office">{office}</p>
        </div>
        {/* Keeps the lines centred on the page next to the logo. */}
        <span aria-hidden="true" className="report-letterhead__balance" />
      </div>
      <h1 className="report-letterhead__title">{title}</h1>
      <p className="report-letterhead__subtitle">{subtitle}</p>
      <dl className="report-letterhead__meta">
        <div>
          <dt>{coverage}</dt>
        </div>
        <div>
          <dd>{printedOn}</dd>
        </div>
      </dl>
    </header>
  )
}

/** Signature lines under the report. Blank on purpose: nothing is signed for anyone. */
export function ReportSignatories({
  preparedByLabel,
  preparedByName,
  notedByLabel,
  notedByTitle,
}: {
  preparedByLabel: string
  preparedByName: ReactNode
  notedByLabel: string
  notedByTitle: string
}) {
  return (
    <footer className="report-signatories hidden print:grid">
      <div>
        <p className="report-signatories__label">{preparedByLabel}</p>
        <p className="report-signatories__name">{preparedByName}</p>
      </div>
      <div>
        <p className="report-signatories__label">{notedByLabel}</p>
        <p className="report-signatories__name">&nbsp;</p>
        <p className="report-signatories__title">{notedByTitle}</p>
      </div>
    </footer>
  )
}
