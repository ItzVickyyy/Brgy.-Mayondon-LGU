/**
 * Quiet marks on the navy navigation sidebar, in the same spirit as the page
 * backdrop (AppBackdrop): solid shapes at a few percent of the sidebar's own
 * text colour, no gradients, no motion, no gold. They sit at the bottom, away
 * from the menu items, are hidden from assistive technology and from print, and
 * disappear when the sidebar is collapsed to icons.
 */
export function SidebarBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-testid="sidebar-backdrop"
      className="pointer-events-none absolute inset-0 overflow-hidden print:hidden group-data-[collapsible=icon]:hidden"
    >
      <div className="absolute -bottom-16 -right-14 size-52 rounded-full bg-sidebar-foreground/[0.04]" />
      <div className="absolute -bottom-8 -left-10 size-32 rounded-full border-[10px] border-sidebar-foreground/[0.04]" />
      <div className="app-backdrop-dots app-backdrop-dots-sidebar absolute bottom-24 right-5 h-14 w-20" />
      <div className="app-backdrop-plus app-backdrop-plus-sidebar absolute bottom-40 left-6 size-3" />
      <div className="absolute bottom-32 right-12 size-1.5 rounded-full bg-sidebar-foreground/[0.10]" />
    </div>
  )
}
