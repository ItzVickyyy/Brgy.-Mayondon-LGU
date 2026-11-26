// Tables that turn into cards when their own box is narrow (patch 276).
// A container query on the scrolling box (container name "cards", so the
// sidebar is accounted for) picks the layout: from 59rem a normal table, below
// it every row is a card: first cell on its own line, the other cells wrapped
// side by side with their column name in front, the buttons last. The Actions
// cell is no longer sticky there. The class strings are written out in full so
// Tailwind can see them; `index.css` switches off the Actions edge shadow.
export const cardTable = {
  box: "@container/cards overflow-x-auto",
  table: "@max-[59rem]/cards:block",
  head: "@max-[59rem]/cards:hidden",
  body: "@max-[59rem]/cards:block",
  row: "@max-[59rem]/cards:flex @max-[59rem]/cards:flex-wrap @max-[59rem]/cards:gap-x-4 @max-[59rem]/cards:gap-y-1 @max-[59rem]/cards:px-4 @max-[59rem]/cards:py-3",
  cell: "@max-[59rem]/cards:block @max-[59rem]/cards:p-0",
  full: "@max-[59rem]/cards:block @max-[59rem]/cards:w-full @max-[59rem]/cards:p-0",
  labelled:
    "@max-[59rem]/cards:block @max-[59rem]/cards:p-0 @max-[59rem]/cards:before:mr-1 @max-[59rem]/cards:before:text-xs @max-[59rem]/cards:before:text-muted-foreground @max-[59rem]/cards:before:content-[attr(data-label)]",
  actions:
    "@max-[59rem]/cards:static @max-[59rem]/cards:block @max-[59rem]/cards:w-full @max-[59rem]/cards:bg-transparent @max-[59rem]/cards:p-0 @max-[59rem]/cards:pt-1",
  // Batch selection (278): a checkbox column in table mode; in card mode the box
  // sits at the card's top-right corner and the name cell leaves room for it.
  // `selectRow` goes on the <tr>, `selectName` on the name cell.
  select:
    "w-11 @max-[59rem]/cards:absolute @max-[59rem]/cards:right-2 @max-[59rem]/cards:top-2 @max-[59rem]/cards:block @max-[59rem]/cards:w-auto @max-[59rem]/cards:p-0",
  selectRow: "@max-[59rem]/cards:relative",
  selectName: "@max-[59rem]/cards:pr-9",
} as const

// The same card layout for the User Accounts table, which is too wide for a 1280 px laptop (its
// box is about 972 px, 1171 px of columns in English and 1277 px in Filipino): cards below
// 75rem, container "wide-cards" (patch 311). `index.css` switches off the Actions edge shadow.
export const wideCardTable = {
  box: "@container/wide-cards overflow-x-auto",
  table: "@max-[75rem]/wide-cards:block",
  head: "@max-[75rem]/wide-cards:hidden",
  body: "@max-[75rem]/wide-cards:block",
  row: "@max-[75rem]/wide-cards:flex @max-[75rem]/wide-cards:flex-wrap @max-[75rem]/wide-cards:gap-x-4 @max-[75rem]/wide-cards:gap-y-1 @max-[75rem]/wide-cards:px-4 @max-[75rem]/wide-cards:py-3",
  cell: "@max-[75rem]/wide-cards:block @max-[75rem]/wide-cards:p-0",
  full: "@max-[75rem]/wide-cards:block @max-[75rem]/wide-cards:w-full @max-[75rem]/wide-cards:p-0",
  labelled:
    "@max-[75rem]/wide-cards:block @max-[75rem]/wide-cards:p-0 @max-[75rem]/wide-cards:before:mr-1 @max-[75rem]/wide-cards:before:text-xs @max-[75rem]/wide-cards:before:text-muted-foreground @max-[75rem]/wide-cards:before:content-[attr(data-label)]",
  actions:
    "@max-[75rem]/wide-cards:static @max-[75rem]/wide-cards:block @max-[75rem]/wide-cards:w-full @max-[75rem]/wide-cards:bg-transparent @max-[75rem]/wide-cards:p-0 @max-[75rem]/wide-cards:pt-1",
  // Batch selection (278): a checkbox column in table mode; in card mode the box
  // sits at the card's top-right corner and the name cell leaves room for it.
  // `selectRow` goes on the <tr>, `selectName` on the name cell.
  select:
    "w-11 @max-[75rem]/wide-cards:absolute @max-[75rem]/wide-cards:right-2 @max-[75rem]/wide-cards:top-2 @max-[75rem]/wide-cards:block @max-[75rem]/wide-cards:w-auto @max-[75rem]/wide-cards:p-0",
  selectRow: "@max-[75rem]/wide-cards:relative",
  selectName: "@max-[75rem]/wide-cards:pr-9",
} as const
