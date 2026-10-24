/**
 * Single source of truth for the client's branding.
 * The official logo asset is stored under /public/assets/images.
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
  /** Official logo from the repository's public assets folder. */
  logo: "/assets/images/Barangay%20Mayondon%20Logo.png" as string | null,
  developedBy: "BSIT-WMAD, Laguna State Polytechnic University – Los Baños",
} as const

/** Builds a consistent browser-tab title: "Dashboard | Brgy. Mayondon" */
export const pageTitle = (page: string) => `${page} | ${SITE.shortName}`
