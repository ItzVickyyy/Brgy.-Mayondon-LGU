// Dashboard stat colors. Full class names are written out so Tailwind sees
// them. The colors are CSS variables (--stat-*) with light and dark values.
export const statTones = {
  blue: {
    text: "text-stat-blue",
    bg: "bg-stat-blue",
  },
  green: {
    text: "text-stat-green",
    bg: "bg-stat-green",
  },
  amber: {
    text: "text-stat-amber",
    bg: "bg-stat-amber",
  },
  violet: {
    text: "text-stat-violet",
    bg: "bg-stat-violet",
  },
  rose: {
    text: "text-stat-rose",
    bg: "bg-stat-rose",
  },
  teal: {
    text: "text-stat-teal",
    bg: "bg-stat-teal",
  },
} as const

export type StatTone = keyof typeof statTones

// Order used when a list needs one color per row or bar.
export const statCycle: StatTone[] = [
  "blue",
  "green",
  "amber",
  "violet",
  "rose",
  "teal",
]
