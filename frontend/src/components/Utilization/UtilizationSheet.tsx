import { formatLocaleNumber } from "@/lib/locale"
import { longDate, monthLabel } from "@/lib/utilizationCert"

const BARANGAY_LOGO = "/assets/images/Barangay Mayondon Logo.png"
const LSPU_SEAL = "/assets/images/LSPU Seal.png"

// The wording below is the barangay's own Certificate of Utilization (BMIRMS_Mayondon.docx, Nov 2026),
// word for word. It is always English and never changes with the interface language.
// Styles: index.css, `.cou-*`.
const DETAILS: readonly (readonly [string, string])[] = [
  [
    "Extension Program",
    "KOMUNITECH: Technology for Stronger Communities and Better Services",
  ],
  ["Program Leader", "Merardo Arenas Camba, Jr."],
  ["Project Leader", "Olivia N. Galang"],
  [
    "Implementing Unit",
    "LSPU – Los Baños Campus, College of Arts and Sciences",
  ],
  [
    "System Utilized",
    "Barangay Mayondon Issuance and Records Management System (BMIRMS)",
  ],
  [
    "Co-developer",
    "Salen, Vic John Oboza Jr.; Reboton, Justin Adrian Policarpio; Fajardo, Jean Mervin Gopolla",
  ],
  ["Partner Agency", "Barangay Mayondon Los Baños Laguna"],
]

const SCALE: readonly (readonly [string, string])[] = [
  ["1", "Poor / Underutilized"],
  ["2", "Below Expectations"],
  ["3", "Satisfactory / Moderately Utilized"],
  ["4", "Very Satisfactory / Effectively Utilized"],
  ["5", "Outstanding / Fully Optimized"],
]

/**
 * The printed page. Rendered only into the print-only container of `UtilizationCertDialog`.
 * The system fills in the reporting period, the dates counted and the total of clients served. The
 * rating, the remarks, the date of issue and the signature are left blank on purpose: they belong to
 * the person who certifies, and nothing is rated, signed or dated for anyone.
 */
export function UtilizationSheet({
  month,
  monthStart,
  monthEnd,
  clientsServed,
}: {
  month: string
  monthStart: string
  monthEnd: string
  clientsServed: number
}) {
  return (
    <article className="cou-sheet" data-testid="utilization-sheet">
      <header className="cou-head">
        <img src={BARANGAY_LOGO} alt="" className="cou-head__logo" />
        <div className="cou-head__lines">
          <p>Republic of the Philippines</p>
          <p>Province of Laguna</p>
          <p className="cou-head__municipality">MUNICIPALITY OF LOS BAÑOS</p>
          <p className="cou-head__barangay">BARANGAY MAYONDON</p>
        </div>
      </header>
      <h1 className="cou-title">CERTIFICATE OF UTILIZATION</h1>
      <p className="cou-text">
        This is to certify that the{" "}
        <strong>
          Barangay Mayondon Issuance and Records Management System (BMIRMS)
        </strong>
        , developed under the <strong>Komunitech Program</strong> of the Laguna
        State Polytechnic University – Los Baños Campus, College of Arts and
        Sciences, has been installed and utilized by{" "}
        <strong>Brgy Mayondon, Los Baños, Laguna</strong> in the delivery of its
        services to constituents.
      </p>
      <h2 className="cou-heading">System and Program Details</h2>
      <table className="cou-table">
        <tbody>
          {DETAILS.map(([key, value]) => (
            <tr key={key}>
              <th scope="row">{key}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="cou-heading">Utilization Report</h2>
      <p className="cou-line">
        <strong>Reporting Period (Month/Year):</strong>{" "}
        <span className="cou-fill cou-fill--period">{monthLabel(month)}</span>
      </p>
      <p className="cou-line" data-testid="utilization-sheet-clients">
        <strong>Total No. of Clients Served as of:</strong>{" "}
        <span className="cou-fill">{longDate(monthStart)}</span> –{" "}
        <span className="cou-fill">{longDate(monthEnd)}</span>
        {"  "}
        <strong>Total:</strong>{" "}
        <span className="cou-fill cou-fill--total">
          {formatLocaleNumber(clientsServed)}
        </span>
      </p>
      <p className="cou-line">
        <strong>Utilization Performance Rating: _____ out of 5</strong>{" "}
        <em>(see rating scale below)</em>
      </p>
      <table className="cou-scale">
        <thead>
          <tr>
            {SCALE.map(([score]) => (
              <th key={score}>{score}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {SCALE.map(([score, meaning]) => (
              <td key={score}>{meaning}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="cou-remarks">
        <strong>Remarks / Observations:</strong>
        <span className="cou-rule" />
      </p>
      <p className="cou-rule-row">
        <span className="cou-rule" />
      </p>
      <p className="cou-text cou-text--issued">
        This certification is issued upon the request of the Komunitech Program
        of LSPU–Los Baños Campus, College of Arts and Sciences, for monitoring,
        evaluation, and reporting purposes.
      </p>
      <p className="cou-line">
        Issued this _____ day of _______________, 20___ at Barangay Mayondon,
        Los Baños, Laguna.
      </p>
      <div className="cou-sign">
        <p>Certified true and correct by:</p>
        <p className="cou-sign__line">_________________________________</p>
        <p>Signature over Printed Name</p>
        <p>
          <strong>Head, Office of the Municipal Agriculturist</strong>
        </p>
        <p>Los Baños, Laguna</p>
      </div>
      <footer className="cou-foot">
        <img src={LSPU_SEAL} alt="" className="cou-foot__seal" />
        <div>
          <p className="cou-foot__strong">
            This software was developed by the LSPU-LBC-CAS through the
            KOMUNITECH Program.
          </p>
          <p>
            KOMUNITECH: Technology for Stronger Communities and Better Services
            &nbsp;·&nbsp; To be submitted monthly to LSPU-LBC CAS
          </p>
        </div>
      </footer>
    </article>
  )
}
