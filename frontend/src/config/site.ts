import i18n from "@/i18n"

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
  /** Name of the system shown in headings */
  systemName: "Barangay Mayondon LGU System",
  /** Official logo from the repository's public assets folder. */
  logo: "/assets/images/Barangay%20Mayondon%20Logo.png" as string | null,
  developedBy: "BSIT-WMAD, Laguna State Polytechnic University – Los Baños",
} as const

/**
 * Starting password of every account an administrator creates or resets. The
 * account must change it at first sign-in. Keep equal to DEFAULT_PASSWORD in
 * backend/app/core/security.py.
 */
export const DEFAULT_PASSWORD = "ChangeThisPassword"

const PAGE_TITLE_KEYS = {
  "Activity Log": "common.pageTitles.activityLog",
  "User Accounts": "common.pageTitles.userAccounts",
  "Backup and Restore": "common.pageTitles.backupRestore",
  Dashboard: "common.pageTitles.dashboard",
  "Issuances Management": "common.pageTitles.issuances",
  Officials: "common.pageTitles.officials",
  "Records Management": "common.pageTitles.records",
  "Management Reports": "common.pageTitles.reports",
  "Change Password": "common.pageTitles.changePassword",
  "Log In": "common.pageTitles.login",
  "Recover Password": "common.pageTitles.recoverPassword",
  "Reset Password": "common.pageTitles.resetPassword",
} as const

/** Builds a localized browser-tab title, such as "Dashboard | Brgy. Mayondon". */
export const pageTitle = (page: string) => {
  const key = PAGE_TITLE_KEYS[page as keyof typeof PAGE_TITLE_KEYS]
  const localizedPage = key ? i18n.t(key) : page
  return `${localizedPage} | ${SITE.shortName}`
}
