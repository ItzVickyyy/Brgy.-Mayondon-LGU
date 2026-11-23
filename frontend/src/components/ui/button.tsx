import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// A tiny press-down so clicks feel acknowledged (off for reduced motion).
const press = "active:scale-[0.98] motion-reduce:active:scale-100"

// Soft tinted buttons (Dashboard stat colors, see index.css): clear but not bright. The tone sets --tone; the
// border, fill and text are mixed from it so the same classes work in light and dark mode.
const tint = (tone: string) =>
  `${tone} border border-[color-mix(in_oklab,var(--tone)_45%,var(--border))] bg-[color-mix(in_oklab,var(--tone)_10%,var(--background))] text-[color-mix(in_oklab,var(--tone)_72%,var(--foreground))] shadow-xs hover:bg-[color-mix(in_oklab,var(--tone)_20%,var(--background))] ${press}`

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm ${press}`,
        destructive: `bg-destructive text-white shadow-xs hover:bg-destructive/90 hover:shadow-sm focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 ${press}`,
        // Inside a pop-up an outline button (Close, Cancel, Edit, Back) gets a thicker brand-coloured
        // border and bold brand text, so it reads as a button and not as plain text.
        outline: `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 in-data-[slot=dialog-content]:border-2 in-data-[slot=dialog-content]:border-brand/60 in-data-[slot=dialog-content]:font-semibold in-data-[slot=dialog-content]:text-brand in-data-[slot=dialog-content]:shadow-sm dark:in-data-[slot=dialog-content]:border-brand/60 ${press}`,
        secondary: `bg-secondary text-secondary-foreground hover:bg-secondary/80 ${press}`,
        // Inside a pop-up a ghost button gets an outline so Cancel, Edit and
        // similar actions are easy to see (the pop-up is the in-data parent).
        ghost: `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 in-data-[slot=dialog-content]:border in-data-[slot=dialog-content]:border-input in-data-[slot=dialog-content]:bg-background in-data-[slot=dialog-content]:font-semibold in-data-[slot=dialog-content]:shadow-xs ${press}`,
        // Main call to action: navy fill with the soft navy ring of the original Issue Document button.
        cta: `bg-primary text-primary-foreground shadow-md ring-2 ring-primary/25 ring-offset-2 ring-offset-background hover:bg-primary/90 hover:shadow-lg ${press}`,
        tintBlue: tint("[--tone:var(--stat-blue)]"),
        tintGreen: tint("[--tone:var(--stat-green)]"),
        tintTeal: tint("[--tone:var(--stat-teal)]"),
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        sm: "h-11 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-11",
        "icon-sm": "size-11",
        "icon-lg": "size-11",
        cta: "h-12 gap-2 px-6 text-base font-semibold has-[>svg]:px-5 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
