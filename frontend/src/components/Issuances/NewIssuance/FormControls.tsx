import { Check, ChevronDown, Search } from "lucide-react"
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { formControlClass } from "@/components/Common/formStyles"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { panelClass, useClickOutside, useOpenUpward } from "./popover"

export type ChoiceOption = string | { value: string; label: string }

function optionValue(option: ChoiceOption) {
  return typeof option === "string" ? option : option.value
}
function optionLabel(option: ChoiceOption) {
  return typeof option === "string" ? option : option.label
}

/** Lists with this many choices (or more) get a search box. */
const SEARCH_FROM = 5

/** Shows the part of a label that matches what was typed in bold. */
function Highlight({
  text,
  query,
}: {
  text: string
  query: string
}): ReactNode {
  const q = query.trim().toLowerCase()
  const at = q ? text.toLowerCase().indexOf(q) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-semibold text-foreground">
        {text.slice(at, at + q.length)}
      </strong>
      {text.slice(at + q.length)}
    </>
  )
}

/** Matches that start with the typed text come first, then the rest. */
function filterItems<T extends { label: string }>(items: T[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return items
  const starts: T[] = []
  const contains: T[] = []
  for (const item of items) {
    const label = item.label.toLowerCase()
    if (label.startsWith(q)) starts.push(item)
    else if (label.includes(q)) contains.push(item)
  }
  return [...starts, ...contains]
}

type SelectFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly ChoiceOption[]
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  describedBy?: string
  className?: string
  /** Force the search box on or off. By default it shows for 5 or more choices. */
  searchable?: boolean
}

/**
 * Dropdown that replaces the browser's default <select>.
 * With 5 or more choices it has a search box, so the person can type a few
 * letters instead of scrolling.
 */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  invalid,
  disabled,
  describedBy,
  className,
  searchable,
}: SelectFieldProps) {
  const items = options.map((option) => ({
    value: optionValue(option),
    label: optionLabel(option),
  }))
  const withSearch = searchable ?? items.length >= SEARCH_FROM
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const upward = useOpenUpward(open, wrapperRef, panelRef)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(open, wrapperRef, close)

  const shown = filterItems(items, query)
  const selected = items.find((item) => item.value === value)

  function openPanel() {
    if (disabled) return
    const index = items.findIndex((item) => item.value === value)
    setQuery("")
    setActive(Math.max(index, 0))
    setOpen(true)
  }

  // Put the cursor where the person can act: the search box, or the list.
  useEffect(() => {
    if (!open) return
    if (withSearch) searchRef.current?.focus()
    else panelRef.current?.focus()
  }, [open, withSearch])

  // Keep the highlighted row visible while moving with the arrow keys.
  useEffect(() => {
    if (!open) return
    document
      .getElementById(`${listId}-option-${active}`)
      ?.scrollIntoView?.({ block: "nearest" })
  }, [open, active, listId])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, shown.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === "Home") {
      event.preventDefault()
      setActive(0)
    } else if (event.key === "End") {
      event.preventDefault()
      setActive(Math.max(shown.length - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      if (shown[active]) choose(shown[active].value)
    } else if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === "Tab") {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault()
            if (!open) openPanel()
          }
        }}
        className={cn(
          formControlClass,
          "flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: keyboard handling for the open list
        <div
          ref={panelRef}
          data-popover-open="true"
          role="presentation"
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          className={cn(
            panelClass,
            "min-w-40 outline-none",
            upward ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {withSearch ? (
            <div className="relative border-b p-1.5">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                placeholder="Type to search…"
                aria-label="Search the choices"
                autoComplete="off"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={
                  shown[active] ? `${listId}-option-${active}` : undefined
                }
                className="h-9 w-full rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          ) : null}
          <div
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto p-0.5"
          >
            {shown.length ? (
              shown.map((item, index) => (
                <div
                  key={item.value}
                  id={`${listId}-option-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={item.value === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item.value)}
                  onKeyDown={() => undefined}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                    index === active && "bg-accent text-accent-foreground",
                    item.value === value && "font-medium",
                  )}
                >
                  <span>
                    <Highlight text={item.label} query={query} />
                  </span>
                  {item.value === value ? (
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </div>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Nothing matches “{query.trim()}”.
              </p>
            )}
          </div>
          {withSearch && !query.trim() && shown.length > 8 ? (
            <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              {shown.length} choices. Type to narrow them down.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type ComboFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  invalid?: boolean
  describedBy?: string
  placeholder?: string
}

/** A text box with a tidy suggestion list. The person can pick one or type their own. */
export function ComboField({
  id,
  value,
  onChange,
  options,
  invalid,
  describedBy,
  placeholder,
}: ComboFieldProps) {
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const upward = useOpenUpward(open, wrapperRef, panelRef)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(open, wrapperRef, close)

  const query = value.trim().toLowerCase()
  const exact = options.some((option) => option.toLowerCase() === query)
  const shown =
    !query || exact
      ? [...options]
      : filterItems(
          options.map((label) => ({ label })),
          query,
        ).map((item) => item.label)

  useEffect(() => {
    if (!open) return
    document
      .getElementById(`${listId}-option-${active}`)
      ?.scrollIntoView?.({ block: "nearest" })
  }, [open, active, listId])

  function pick(option: string) {
    onChange(option)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) setOpen(true)
      else setActive((index) => Math.min(index + 1, shown.length - 1))
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter" && open && shown[active]) {
      event.preventDefault()
      event.stopPropagation()
      pick(shown[active])
    } else if (event.key === "Escape" && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    } else if (event.key === "Tab") {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          formControlClass,
          "pr-10",
          invalid && "border-destructive",
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show choices"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
      >
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && shown.length ? (
        <div
          ref={panelRef}
          data-popover-open="true"
          className={cn(
            panelClass,
            "w-full",
            upward ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <div
            id={listId}
            role="listbox"
            className="max-h-60 overflow-y-auto p-0.5"
          >
            {shown.map((option, index) => (
              <div
                key={option}
                id={`${listId}-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={option === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option)}
                onKeyDown={() => undefined}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                  index === active && "bg-accent text-accent-foreground",
                )}
              >
                <span>
                  <Highlight text={option} query={exact ? "" : value} />
                </span>
                {option === value ? <Check className="size-4" /> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type CheckFieldProps = {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  /** "box" draws a bordered tile that fills in when ticked. */
  variant?: "plain" | "box"
}

/** Large, easy-to-hit checkbox. The whole label is clickable. */
export function CheckField({
  id,
  checked,
  onChange,
  label,
  disabled,
  invalid,
  describedBy,
  variant = "plain",
}: CheckFieldProps) {
  const autoId = useId()
  const checkboxId = id ?? autoId
  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-normal select-none",
        variant === "box" &&
          "rounded-lg border bg-background px-3.5 transition-colors hover:bg-muted",
        variant === "box" && checked && "border-brand bg-brand/5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={checked}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onCheckedChange={(next) => onChange(next === true)}
        className="size-5 rounded-md border-2 border-muted-foreground/50 bg-background data-[state=checked]:border-brand [&_svg]:size-4"
      />
      <span className={cn(checked && variant === "box" && "font-medium")}>
        {label}
      </span>
    </label>
  )
}

type ChoiceRowProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  label: string
}

/** Two or three big buttons in a row (for example Male / Female). */
export function ChoiceRow({
  id,
  value,
  onChange,
  options,
  label,
}: ChoiceRowProps) {
  const name = useId()
  return (
    <fieldset
      id={id}
      aria-label={label}
      className="m-0 grid h-11 min-w-0 gap-1.5 border-0 p-0"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const selected = option === value
        return (
          <label
            key={option}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-md border bg-background text-sm transition-colors hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              selected &&
                "border-brand bg-brand/10 font-medium text-brand hover:bg-brand/10",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={selected}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        )
      })}
    </fieldset>
  )
}
