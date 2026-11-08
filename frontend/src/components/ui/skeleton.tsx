import { cn } from "@/lib/utils"

// A soft light sweep (see `shimmer` in index.css). Under "reduce motion" the
// sweep is hidden and the block stays a calm static placeholder.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-accent relative overflow-hidden rounded-md before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent motion-reduce:before:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
