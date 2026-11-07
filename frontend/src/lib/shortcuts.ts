/** One list used by the shortcut handler and by the help screens, so they never disagree. */
export type ShortcutItem = { keys: string[]; description: string }

export const SHORTCUTS: ShortcutItem[] = [
  { keys: ["?"], description: "Show this list of keyboard shortcuts" },
  { keys: ["/"], description: "Jump to the search box on the page" },
  { keys: ["G", "then", "D"], description: "Go to Dashboard" },
  { keys: ["G", "then", "R"], description: "Go to Records Management" },
  { keys: ["G", "then", "I"], description: "Go to Issuance Management" },
  { keys: ["G", "then", "A"], description: "Go to Activity Log" },
  { keys: ["N"], description: "Start a New Issuance (on the Issuance page)" },
  { keys: ["Ctrl", "+", "B"], description: "Show or hide the sidebar" },
  { keys: ["Tab"], description: "Move to the next control" },
  { keys: ["Shift", "+", "Tab"], description: "Move to the previous control" },
  { keys: ["Esc"], description: "Close a window or clear the search" },
]

/** Second key after G, mapped to a page. */
export const GO_TO: Record<
  string,
  "/" | "/records" | "/issuances" | "/activity-log"
> = {
  d: "/",
  r: "/records",
  i: "/issuances",
  a: "/activity-log",
}
