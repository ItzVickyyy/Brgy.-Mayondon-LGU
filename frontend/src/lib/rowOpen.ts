import type { MouseEvent } from "react"

// Controls inside a row that handle their own double-clicks (buttons, menus,
// the selection checkbox, links, inputs). A double-click on any of them must
// not also open the row.
const OWN_CLICK =
  "button, a, input, select, textarea, label, [role], [data-slot]"

/**
 * Props for a table row that opens its "view" when double-clicked.
 * Spread onto the `<tr>`: `<tr {...rowOpen(() => openView(item))}>`.
 * The row also gets `data-row-open`, which `index.css` uses for the pointer
 * cursor and the stronger hover tint. A row with no view does not use this.
 */
export function rowOpen(onOpen: () => void) {
  return {
    "data-row-open": "",
    onDoubleClick: (event: MouseEvent<HTMLElement>) => {
      const row = event.currentTarget
      const target = event.target as HTMLElement
      // Only controls inside this row count: closest() also walks above the row
      // (a card or table wrapper with a role or data-slot), which must not block it.
      const own = target.closest(OWN_CLICK)
      if (own && own !== row && row.contains(own)) return
      window.getSelection()?.removeAllRanges()
      onOpen()
    },
  }
}
