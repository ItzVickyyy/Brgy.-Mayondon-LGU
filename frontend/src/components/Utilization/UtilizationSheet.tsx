import { barangayProfile } from "@/config/barangay-profile"
import { formatLocaleNumber } from "@/lib/locale"
import {
  monthLabel,
  monthName,
  parseMonthKey,
  signatoryLine,
} from "@/lib/utilizationCert"

const BARANGAY_LOGO = "/assets/images/Barangay Mayondon Logo.png"
const LSPU_SEAL = "/assets/images/LSPU Seal.png"

// The wording below is the barangay's own Certificate of Utilization (Word file, Nov 2026), word for
// word. It is always English and never changes with the interface language. Styles: index.css, `.cou-*`.
const ROWS: readonly (readonly [string, string, boolean])[] = [
  [
    "Extension Program",
    "KOMUNITECH: Technology for Stronger Communities and Better Services",
    false,
  ],
  ["Program Leader", "Merardo Arenas Camba, Jr.", false],
  ["Project Leader", "Ms. Olivia N. Galang", false],
  [
    "Implementing Unit",
    "LSPU – Los Baños, College of Arts and Sciences",
    false,
  ],
  [
    "System Utilized",
    "Barangay Mayondon Issuance and Records Management System (BMIRMS)",
    true,
  ],
  ["Co-Developers", "Vic John O. Salen Jr.; Justin Adrian P. Reboton", false],
  ["Partner Agency", "Barangay Mayondon, Los Baños, Laguna", false],
]

/**
 * The printed page. Rendered only into the print-only container of `UtilizationCertDialog`.
 * The date of issue and the signature are left blank on purpose: nothing is signed or dated for anyone.
 */
export function UtilizationSheet({
  month,
  clientsServed,
  punongBarangay,
}: {
  month: string
  clientsServed: number
  punongBarangay: string | null
}) {
  const label = monthLabel(month)
  const name = monthName(parseMonthKey(month).month)
  const [country, , province, municipality, barangay, office] =
    barangayProfile.headerLines
  return (
    <article className="cou-sheet" data-testid="utilization-sheet">
      <header className="cou-head">
        <img src={BARANGAY_LOGO} alt="" className="cou-head__logo" />
        <div className="cou-head__lines">
          <p>{country}</p>
          <p>{province}</p>
          <p>{municipality.toUpperCase()}</p>
          <p className="cou-head__barangay">{barangay}</p>
          <p className="cou-head__office">{office}</p>
          <p className="cou-head__contact">
            Telephone No.: (049) 502-2443 &nbsp; Gmail Address:
            lgudonmayon@gmail.com.ph
          </p>
        </div>
      </header>
      <h1 className="cou-title">CERTIFICATE OF UTILIZATION</h1>
      <p className="cou-month">For the Month of {label}</p>
      <p className="cou-text">
        This is to certify that{" "}
        <strong>Barangay Mayondon, Municipality of Los Baños, Laguna</strong>{" "}
        has utilized the{" "}
        <strong>
          Barangay Mayondon Issuance and Records Management System (BMIRMS)
        </strong>{" "}
        in the delivery of its services to its residents and clients for the
        month of {label}.
      </p>
      <p className="cou-text">
        The said system was developed by the{" "}
        <strong>
          Laguna State Polytechnic University – Los Baños Campus, College of
          Arts and Sciences (LSPU-LBC CAS)
        </strong>{" "}
        through its Extension Program{" "}
        <strong>
          <em>
            KOMUNITECH: Technology for Stronger Communities and Better Services
          </em>
        </strong>
        .
      </p>
      <table className="cou-table">
        <tbody>
          {ROWS.map(([key, value, bold]) => (
            <tr key={key}>
              <th scope="row">{key}</th>
              <td className={bold ? "cou-table__bold" : undefined}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cou-total" data-testid="utilization-sheet-clients">
        <strong>Total number of clients served as of</strong>{" "}
        {`${name} : ${formatLocaleNumber(clientsServed)}`}
      </p>
      <p className="cou-text">
        Issued this ______ day of ____________________, 20____ at the Barangay
        Hall of Barangay Mayondon, Los Baños, Laguna, for the monitoring and
        reporting requirements of the LSPU-LBC CAS Extension Program.
      </p>
      <div className="cou-sign">
        <p className="cou-sign__lead">Certified true and correct by:</p>
        <p className="cou-sign__name">{signatoryLine(punongBarangay)}</p>
        <p>Punong Barangay</p>
        <p>Barangay Mayondon, Los Baños, Laguna</p>
      </div>
      <footer className="cou-foot">
        <img src={LSPU_SEAL} alt="" className="cou-foot__seal" />
        <div>
          <p className="cou-foot__strong">
            This software was developed by the LSPU-LBC CAS through the
            KOMUNITECH Program.
          </p>
          <p>
            KOMUNITECH: Technology for Stronger Communities and Better Services
            · To be submitted monthly to LSPU-LBC CAS
          </p>
        </div>
      </footer>
    </article>
  )
}
