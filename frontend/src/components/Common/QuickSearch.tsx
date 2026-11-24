import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Search, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ResidentsService } from "@/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Ctrl+K (or Cmd+K) from any page: type part of a name, press Enter, and Records opens
 * already searching for that person. English only, like the other shortcut pop-ups.
 */
export function QuickSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [typed, setTyped] = useState("")
  const [active, setActive] = useState(0)
  const listId = "quick-search-results"
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setTyped(text.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [text])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new search starts at the top row.
  useEffect(() => {
    setActive(0)
  }, [typed])

  const results = useQuery({
    queryKey: ["quick-search", typed],
    enabled: open && typed.length >= 2,
    queryFn: async () =>
      (
        await ResidentsService.listResidents({
          query: { q: typed, status: "active", limit: 8 },
        })
      ).data,
  })
  const rows = typed.length >= 2 ? (results.data?.data ?? []) : []

  function close(next: boolean) {
    setOpen(next)
    if (!next) {
      setText("")
      setTyped("")
    }
  }

  function choose(name: string) {
    close(false)
    void navigate({ to: "/records", search: { q: name } })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogTitle className="sr-only">Find a resident</DialogTitle>
        <DialogDescription className="sr-only">
          Type a name, then press Enter to open it in Records.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-4 py-3 pr-12">
          <Search aria-hidden="true" className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            data-testid="quick-search-input"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-activedescendant={
              rows.length ? `quick-search-${active}` : undefined
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && rows.length) {
                event.preventDefault()
                setActive((index) => (index + 1) % rows.length)
              } else if (event.key === "ArrowUp" && rows.length) {
                event.preventDefault()
                setActive((index) => (index - 1 + rows.length) % rows.length)
              } else if (event.key === "Enter") {
                event.preventDefault()
                const row = rows[active]
                if (row) choose(row.full_name)
                else if (text.trim()) choose(text.trim())
              }
            }}
            placeholder="Find a resident by name"
            maxLength={100}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label="Matching residents"
          className="max-h-72 overflow-y-auto"
        >
          {rows.map((row, index) => (
            <div
              key={row.id}
              tabIndex={-1}
              id={`quick-search-${index}`}
              role="option"
              aria-selected={index === active}
              data-testid="quick-search-row"
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(row.full_name)}
              onKeyDown={() => {}}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm",
                index === active && "bg-accent text-accent-foreground",
              )}
            >
              <UserRound
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {row.full_name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {[row.birthdate, row.purok ? `Purok ${row.purok}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          {typed.length < 2
            ? "Type at least 2 letters."
            : results.isFetching
              ? "Searching…"
              : rows.length
                ? "Up and Down to choose, Enter to open in Records."
                : "No match. Enter searches Records for what you typed."}
        </p>
      </DialogContent>
    </Dialog>
  )
}
