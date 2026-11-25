// Capsule (badge) colours, shared by every table. One tone = one meaning, the same everywhere:
// green = fine / done, amber = needs attention, red = failed / over, blue = information,
// violet = administrator, teal = staff, grey = inactive / neutral.
// Each tone is a soft tint of the app's own `--stat-*` colour with a small icon (drawn by the
// `.badge-ic` rules in index.css, so no table has to change), so light and dark mode follow the
// theme and the meaning never depends on colour alone (the text always says it). A capsule that
// already holds its own icon shows only that one (`.badge-ic:has(> svg)` hides the tone icon).
const dot = "badge-ic gap-1"

export const badgeTone = {
  green:
    "badge-ic-green border-[color-mix(in_oklab,var(--stat-green)_40%,transparent)] bg-[color-mix(in_oklab,var(--stat-green)_15%,transparent)] text-[color-mix(in_oklab,var(--stat-green)_62%,var(--foreground))] " +
    dot,
  amber:
    "badge-ic-amber border-[color-mix(in_oklab,var(--stat-amber)_40%,transparent)] bg-[color-mix(in_oklab,var(--stat-amber)_15%,transparent)] text-[color-mix(in_oklab,var(--stat-amber)_62%,var(--foreground))] " +
    dot,
  red:
    "badge-ic-red border-[color-mix(in_oklab,var(--stat-rose)_40%,transparent)] bg-[color-mix(in_oklab,var(--stat-rose)_15%,transparent)] text-[color-mix(in_oklab,var(--stat-rose)_62%,var(--foreground))] " +
    dot,
  blue:
    "badge-ic-blue border-[color-mix(in_oklab,var(--stat-blue)_40%,transparent)] bg-[color-mix(in_oklab,var(--stat-blue)_15%,transparent)] text-[color-mix(in_oklab,var(--stat-blue)_62%,var(--foreground))] " +
    dot,
  violet:
    "badge-ic-violet border-[color-mix(in_oklab,var(--stat-violet)_40%,transparent)] bg-[color-mix(in_oklab,var(--stat-violet)_15%,transparent)] text-[color-mix(in_oklab,var(--stat-violet)_62%,var(--foreground))] " +
    dot,
  teal:
    "badge-ic-teal border-[color-mix(in_oklab,var(--stat-teal)_40%,transparent)] bg-[color-mix(in_oklab,var(--stat-teal)_15%,transparent)] text-[color-mix(in_oklab,var(--stat-teal)_62%,var(--foreground))] " +
    dot,
  grey: `badge-ic-grey border-border bg-muted text-muted-foreground ${dot}`,
} as const

const { green, amber, red, grey } = badgeTone

export const statusStyles: Record<string, string> = {
  Success: green,
  Completed: green,
  Approved: green,
  Current: green,
  Valid: green,
  Issued: green,
  Verified: green,
  Active: green,
  "Expiring soon": amber,
  Pending: `${amber} badge-ic-clock`,
  Denied: amber,
  Expiring: amber,
  Expired: red,
  Failed: red,
  Rejected: red,
  Archived: grey,
  None: grey,
  Former: grey,
  Voided: grey,
  "Not checked": grey,
  Inactive: grey,
  "In progress": `${badgeTone.blue} badge-ic-clock`,
}

/** Role capsules: administrators violet, staff teal. */
export const roleStyles = {
  admin: badgeTone.violet,
  staff: badgeTone.teal,
} as const
