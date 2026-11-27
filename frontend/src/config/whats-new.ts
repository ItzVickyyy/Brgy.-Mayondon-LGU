// What's new: the short list shown from the Get help button. Newest first.
// Add an entry when a release changes something the staff will notice, in plain
// words (no patch numbers). Popup bodies are English only.
export type WhatsNewEntry = { title: string; points: string[] }

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    title: "Deceased residents",
    points: [
      "Records Management has a new Deceased tab. An administrator records a death from a resident's profile or row menu, with the date as far as it is known and whether it was reported or verified.",
      "A deceased resident is no longer counted and cannot be given new documents. A mistake can be corrected or voided by an administrator.",
    ],
  },
  {
    title: "Tables",
    points: [
      "Click a column heading to sort the table; click again to reverse, and a third time to go back.",
      "The number of ticked rows shows in the top bar, at the upper right.",
      "Tick rows to export them, print them or copy them to paste into Excel or Word.",
      "Rows light up when you point at them, and a double click opens View.",
      "Action buttons keep one colour for one meaning on every page.",
    ],
  },
  {
    title: "Backup and Restore",
    points: [
      "Restore now asks for its confirmation in a pop-up.",
      "Verify several backup files at once by ticking them.",
    ],
  },
  {
    title: "Activity Log",
    points: [
      "Each entry reads in labelled lines, and a corrected document shows as Document Edited and Voided.",
    ],
  },
  {
    title: "Accounts and appearance",
    points: [
      "Passwords are changed every 90 days; a reminder screen appears when it is time.",
    ],
  },
]
