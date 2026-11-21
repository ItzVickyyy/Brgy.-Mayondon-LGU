/**
 * Quiet, solid-colour shapes behind the page content, so the area around the
 * cards is not a flat sheet. Navy at a few percent only (no gradients, no gold,
 * no motion), drawn behind everything and hidden from assistive technology and
 * from print. A few very small marks (ring, dots, plus signs, a dot grid) sit
 * between the big shapes; they are tiny and faint on purpose, and only from the
 * `sm` / `md` width up so a phone stays clean. The clipping wrapper is separate from `main`, so sticky table
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
      {/* Small marks: noticed only if you look for them. */}
      <div className="absolute left-[46%] top-6 hidden size-5 rounded-full border-2 border-brand/[0.09] md:block" />
      <div className="absolute right-[26%] top-[34%] hidden size-2 rounded-full bg-brand/[0.12] md:block" />
      <div className="absolute left-[7%] top-[22%] hidden size-1.5 rounded-full bg-brand/[0.12] md:block" />
      <div className="app-backdrop-plus absolute left-[18%] top-[46%] hidden size-3.5 md:block" />
      <div className="app-backdrop-plus absolute bottom-[20%] right-[16%] hidden size-3 md:block" />
      <div className="absolute bottom-[34%] right-[8%] hidden size-3.5 rotate-12 rounded-[3px] border-2 border-brand/[0.09] md:block" />
      <div className="app-backdrop-dots absolute bottom-10 left-[30%] hidden h-16 w-24 md:block" />
    </div>
  )
}
