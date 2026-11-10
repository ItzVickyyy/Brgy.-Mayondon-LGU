import { Check, ChevronDown, Search } from "lucide-react"
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { formControlClass } from "@/components/Common/formStyles"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { panelClass, useClickOutside, useOpenUpward } from "./popover"

export type ChoiceOption =
  | string
  | { value: string; label: string; disabled?: boolean }

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
  /** Name read by screen readers when there is no visible <label>. */
  ariaLabel?: string
  /** Classes for the box around the button (for example a fixed width). */
  wrapperClassName?: string
  /** Always open the list above the button (for the bottom edge of a table). */
  openUp?: boolean
  /**
   * Position the list on the screen instead of inside its parent, so a card
   * or table with `overflow: hidden` cannot cut it off.
   */
  floating?: boolean
  required?: boolean
  /** Extra attributes for the button, such as data-testid. */
  triggerProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "value" | "children"
  >
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
  placeholder,
  invalid,
  disabled,
  describedBy,
  className,
  searchable,
  ariaLabel,
  wrapperClassName,
  openUp,
  floating,
  required,
  triggerProps,
}: SelectFieldProps) {
  const items = options.map((option) => ({
    value: optionValue(option),
    label: optionLabel(option),
    disabled: typeof option === "string" ? false : Boolean(option.disabled),
  }))
  const withSearch = searchable ?? items.length >= SEARCH_FROM
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const typed = useRef({ text: "", at: 0 })
  const [placed, setPlaced] = useState<{
    top: number
    left: number
    minWidth: number
    maxHeight: number
  } | null>(null)
  const measuredUpward = useOpenUpward(open && !floating, wrapperRef, panelRef)
  const upward = Boolean(openUp) || measuredUpward
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

  // Floating list: place it from the button's position on the screen. An
  // ancestor with a transform (a dialog) becomes the origin of `fixed`, so the
  // origin is measured first. Follows scrolling and resizing while open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: shown.length re-places the list when a search changes its height
  useLayoutEffect(() => {
    if (!open || !floating) {
      setPlaced(null)
      return
    }
    function place() {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return
      const box = trigger.getBoundingClientRect()
      const origin = panel.getBoundingClientRect()
      const originLeft =
        origin.left - (Number.parseFloat(panel.style.left) || 0)
      const originTop = origin.top - (Number.parseFloat(panel.style.top) || 0)
      const margin = 8
      const width = Math.max(box.width, 160)
      const below = window.innerHeight - box.bottom - margin
      const above = box.top - margin
      const natural = panel.scrollHeight
      const up = Boolean(openUp) || (below < natural && above > below)
      const room = Math.max(up ? above : below, 160)
      const height = Math.min(natural, room)
      const left = Math.min(
        Math.max(box.left, margin),
        Math.max(window.innerWidth - width - margin, margin),
      )
      setPlaced({
        top: (up ? box.top - height - 4 : box.bottom + 4) - originTop,
        left: left - originLeft,
        minWidth: width,
        maxHeight: room,
      })
    }
    place()
    let frame = 0
    function schedule(event?: Event) {
      if (
        event?.target instanceof Node &&
        panelRef.current?.contains(event.target)
      )
        return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", schedule, true)
    }
  }, [open, floating, openUp, shown.length])

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
    if (items.find((item) => item.value === next)?.disabled) return
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
    } else if (
      !withSearch &&
      event.key.length === 1 &&
      event.key !== " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      // Type-ahead for short lists (no search box): "ma" jumps to "Male".
      const now = Date.now()
      const text =
        (now - typed.current.at < 800 ? typed.current.text : "") +
        event.key.toLowerCase()
      typed.current = { text, at: now }
      const from = text.length === 1 ? active + 1 : active
      const order = [...shown.slice(from), ...shown.slice(0, from)]
      const hit = order.find((item) =>
        item.label.toLowerCase().startsWith(text),
      )
      if (hit) setActive(shown.indexOf(hit))
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative min-w-0", wrapperClassName)}>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-required tells a screen reader the choice is required, as a native select did */}
      <button
        {...triggerProps}
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        // The chosen text is part of the description, so a screen reader says it
        // (a native select announces its value; the label alone would not).
        aria-describedby={
          selected
            ? [describedBy, `${listId}-value`].filter(Boolean).join(" ")
            : describedBy
        }
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
        <span
          id={`${listId}-value`}
          className={cn("truncate", !selected && "text-muted-foreground")}
        >
          {selected?.label ?? placeholder ?? t("issuances.new.controls.choose")}
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
          // Inside a <label>, a click in the list would otherwise be passed on
          // to the button and open the list again.
          onClick={(event) => event.preventDefault()}
          style={
            floating
              ? {
                  position: "fixed",
                  top: placed?.top ?? 0,
                  left: placed?.left ?? 0,
                  minWidth: placed?.minWidth,
                  maxHeight: placed?.maxHeight,
                  opacity: placed ? 1 : 0,
                }
              : undefined
          }
          className={cn(
            panelClass,
            "min-w-40 outline-none",
            floating
              ? "z-50 flex flex-col"
              : upward
                ? "bottom-full mb-1"
                : "top-full mt-1",
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
                placeholder={t("issuances.new.controls.typeToSearch")}
                aria-label={t("issuances.new.controls.searchChoices")}
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
            className="max-h-64 min-h-0 overflow-y-auto p-0.5"
          >
            {shown.length ? (
              shown.map((item, index) => (
                <div
                  key={item.value}
                  id={`${listId}-option-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={item.value === value}
                  aria-disabled={item.disabled || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item.value)}
                  onKeyDown={() => undefined}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                    index === active && "bg-accent text-accent-foreground",
                    item.value === value && "font-medium",
                    item.disabled && "cursor-not-allowed opacity-50",
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
                {t("issuances.new.controls.noMatch", { query: query.trim() })}
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
  const { t } = useTranslation()
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
        aria-label={t("issuances.new.controls.showChoices")}
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
  /** Shown text for an option. The value passed to onChange stays the option itself. */
  optionLabel?: (option: string) => string
  invalid?: boolean
  describedBy?: string
}

/** Two or three big buttons in a row (for example Male / Female). */
export function ChoiceRow({
  id,
  value,
  onChange,
  options,
  label,
  optionLabel,
  invalid,
  describedBy,
}: ChoiceRowProps) {
  const name = useId()
  return (
    <fieldset
      id={id}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(
        "m-0 grid min-w-0 gap-1.5 border-0 p-0",
        invalid && "rounded-md ring-1 ring-destructive",
      )}
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
              "relative flex h-11 cursor-pointer items-center justify-center rounded-md border bg-background px-3 text-sm transition-colors hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
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
            {optionLabel ? optionLabel(option) : option}
          </label>
        )
      })}
    </fieldset>
  )
}
