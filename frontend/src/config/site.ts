/**
 * Single source of truth for the client's branding.
 * After the client interview, update the values here (and drop the official
 * logo into /public/assets/images, then point `logo` at it).
 */
export const SITE = {
  /** Short name shown in the sidebar and browser tab */
  shortName: "Brgy. Mayondon",
  /** Full official name, used in headings and footers */
  fullName: "Barangay Mayondon LGU",
  /** Location line */
  location: "Los Baños, Laguna",
  /** TODO: rename once the system is decided (see docs/ROADMAP.md) */
  systemName: "Barangay Mayondon LGU System",
  /** TODO: replace with the official logo/seal after the interview, e.g.
   *  "/assets/images/brgy-logo.png". While null, a placeholder icon is shown. */
  logo: null as string | null,
  developedBy: "BSIT-WMAD, Laguna State Polytechnic University – Los Baños",
} as const

/** Builds a consistent browser-tab title: "Dashboard | Brgy. Mayondon" */
export const pageTitle = (page: string) => `${page} | ${SITE.shortName}`
