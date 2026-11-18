/**
 * Quiet, solid-colour shapes behind the page content, so the area around the
 * cards is not a flat sheet. Navy at a few percent only (no gradients, no gold,
 * no motion), drawn behind everything and hidden from assistive technology and
 * from print. The clipping wrapper is separate from `main`, so sticky table
 * headers inside the pages keep working.
 */
export function AppBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-testid="app-backdrop"
      className="pointer-events-none absolute inset-0 overflow-hidden print:hidden"
    >
      <div className="absolute -right-28 -top-32 size-[26rem] rounded-full bg-brand/[0.05] dark:bg-brand/[0.05]" />
      <div className="app-backdrop-dots absolute right-12 top-8 hidden h-40 w-40 sm:block" />
      <div className="absolute -bottom-28 -left-24 size-[22rem] rotate-12 rounded-[3rem] bg-brand/[0.05] dark:bg-brand/[0.05]" />
      <div className="absolute bottom-24 left-[42%] hidden size-24 rounded-full border-[10px] border-brand/[0.06] md:block dark:border-brand/[0.06]" />
    </div>
  )
}
