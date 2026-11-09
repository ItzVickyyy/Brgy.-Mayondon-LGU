import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { formControlClass } from "@/components/Common/formStyles"
import { formatPaperDate, monthNames } from "@/lib/issuance-format"
import { formatLocaleDate } from "@/lib/locale"
import { cn } from "@/lib/utils"
import { panelClass, useClickOutside, useOpenUpward } from "./popover"

const weekdayKeys = [
  "issuances.new.date.weekdays.sun",
  "issuances.new.date.weekdays.mon",
  "issuances.new.date.weekdays.tue",
  "issuances.new.date.weekdays.wed",
  "issuances.new.date.weekdays.thu",
  "issuances.new.date.weekdays.fri",
  "issuances.new.date.weekdays.sat",
] as const

// Shown month names follow the language; typed dates are still read with the
// English `monthNames` (see the parser above), so stored values never change.
const shownMonthName = (index: number) =>
  formatLocaleDate(new Date(2000, index, 1), { month: "long" })

function pad(value: number) {
  return String(value).padStart(2, "0")
}
function toIso(year: number, monthIndex: number, day: number) {
  return `${String(year).padStart(4, "0")}-${pad(monthIndex + 1)}-${pad(day)}`
}
function dateToIso(date: Date) {
  return toIso(date.getFullYear(), date.getMonth(), date.getDate())
}
function isoToDate(iso: string) {
  return new Date(`${iso}T00:00:00`)
}
function isIso(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
function todayIso() {
  return dateToIso(new Date())
}

/**
 * Understands what a person is likely to type: "November 3, 2026", "Nov 3 2026",
 * "3 November 2026", "11/3/2026" or "2026-11-03". Returns an ISO date or null.
 */
export function parseLooseDate(text: string): string | null {
  const t = text.trim().replace(/\s+/g, " ")
  let year = 0
  let month = 0
  let day = 0
  const isoMatch = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const slashMatch = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (isoMatch) {
    year = Number(isoMatch[1])
    month = Number(isoMatch[2])
    day = Number(isoMatch[3])
  } else if (slashMatch) {
    const first = Number(slashMatch[1])
    const second = Number(slashMatch[2])
    // Month first (11/3/2026). If the first number cannot be a month, read it as the day.
    if (first > 12 && second <= 12) {
      day = first
      month = second
    } else {
      month = first
      day = second
    }
    year = Number(slashMatch[3])
  } else {
    const match =
      t.match(/^([A-Za-z]{3,})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/) ??
      t.match(/^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,})\.?,? (\d{4})$/)
    if (!match) return null
    const nameFirst = /^[A-Za-z]/.test(match[1])
    const name = (nameFirst ? match[1] : match[2]).toLowerCase()
    const index = monthNames.findIndex((full) =>
      full.toLowerCase().startsWith(name),
    )
    if (index < 0) return null
    month = index + 1
    day = Number(nameFirst ? match[2] : match[1])
    year = Number(match[3])
  }
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null
  return toIso(year, month - 1, day)
}

type View = "days" | "months" | "years"

type CalendarProps = {
  value: string
  min?: string
  max?: string
  /** Open on the year list first. Good for birthdates, which are many years back. */
  startView: "days" | "years"
  showToday: boolean
  onSelect: (iso: string) => void
  /** Called when focus should go back to the text box. */
  onDone: () => void
}

function Calendar({
  value,
  min,
  max,
  startView,
  showToday,
  onSelect,
  onDone,
}: CalendarProps) {
  const initial = isIso(value) ? value : clampIso(todayIso(), min, max)
  const guided = useRef(startView === "years" && !isIso(value))
  const [view, setView] = useState<View>(
    startView === "years" && !isIso(value) ? "years" : "days",
  )
  const { t } = useTranslation()
  const [cursor, setCursor] = useState(() => {
    const date = isoToDate(initial)
    return { year: date.getFullYear(), month: date.getMonth() }
  })
  const [focusIso, setFocusIso] = useState(initial)
  const moveFocus = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const yearsRef = useRef<HTMLDivElement>(null)

  const today = todayIso()
  const minYear = min && isIso(min) ? isoToDate(min).getFullYear() : 1900
  const maxYear =
    max && isIso(max)
      ? isoToDate(max).getFullYear()
      : new Date().getFullYear() + 10

  function outOfRange(iso: string) {
    return Boolean((min && iso < min) || (max && iso > max))
  }

  // Years view: jump the list so the chosen (or current) year is in the middle.
  useEffect(() => {
    if (view !== "years") return
    const list = yearsRef.current
    const target = list?.querySelector<HTMLElement>("[data-anchor='true']")
    if (list && target) {
      list.scrollTop =
        target.offsetTop - list.clientHeight / 2 + target.clientHeight / 2
    }
  }, [view])

  // Move the keyboard focus to the highlighted day, but only after an arrow key.
  useEffect(() => {
    if (view !== "days" || !moveFocus.current) return
    moveFocus.current = false
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-iso='${focusIso}']`)
      ?.focus()
  }, [focusIso, view])

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    let next: Date | null = null
    const current = isoToDate(focusIso)
    if (event.key in steps) {
      next = new Date(current)
      next.setDate(next.getDate() + steps[event.key])
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      next = new Date(current)
      next.setMonth(next.getMonth() + (event.key === "PageUp" ? -1 : 1))
    } else if (event.key === "Home" || event.key === "End") {
      next = new Date(current)
      next.setDate(
        next.getDate() -
          (event.key === "Home" ? current.getDay() : current.getDay() - 6),
      )
    } else if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      onDone()
      return
    }
    if (!next) return
    event.preventDefault()
    const iso = clampIso(dateToIso(next), min, max)
    const date = isoToDate(iso)
    moveFocus.current = true
    setFocusIso(iso)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }

  const header = (
    <div className="flex items-center justify-between gap-1 border-b px-2 py-2">
      <button
        type="button"
        aria-label={t("issuances.new.date.previousMonth")}
        disabled={view !== "days"}
        onClick={() => shiftMonth(-1)}
        className="flex size-9 items-center justify-center rounded-md hover:bg-muted disabled:invisible"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setView(view === "months" ? "days" : "months")}
          aria-expanded={view === "months"}
          className={cn(
            "h-9 rounded-md px-2.5 text-sm font-semibold hover:bg-muted",
            view === "months" && "bg-muted",
          )}
        >
          {shownMonthName(cursor.month)}
        </button>
        <button
          type="button"
          onClick={() => setView(view === "years" ? "days" : "years")}
          aria-expanded={view === "years"}
          className={cn(
            "h-9 rounded-md px-2.5 text-sm font-semibold hover:bg-muted",
            view === "years" && "bg-muted",
          )}
        >
          {cursor.year}
        </button>
      </div>
      <button
        type="button"
        aria-label={t("issuances.new.date.nextMonth")}
        disabled={view !== "days"}
        onClick={() => shiftMonth(1)}
        className="flex size-9 items-center justify-center rounded-md hover:bg-muted disabled:invisible"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )

  let body: ReactNode
  if (view === "years") {
    const years: number[] = []
    for (let year = maxYear; year >= minYear; year -= 1) years.push(year)
    const anchor = isIso(value) ? isoToDate(value).getFullYear() : cursor.year
    body = (
      <div>
        <p className="px-3 pt-2 text-xs text-muted-foreground">
          {t("issuances.new.date.chooseYear")}
        </p>
        <div
          ref={yearsRef}
          className="relative grid max-h-60 grid-cols-4 gap-1 overflow-y-auto p-2"
        >
          {years.map((year) => (
            <button
              key={year}
              type="button"
              data-anchor={year === anchor}
              aria-pressed={year === cursor.year}
              onClick={() => {
                setCursor((current) => ({ ...current, year }))
                setView(guided.current ? "months" : "days")
              }}
              className={cn(
                "h-9 rounded-md text-sm hover:bg-muted",
                year === cursor.year &&
                  "bg-primary text-primary-foreground hover:bg-primary",
                year === new Date().getFullYear() &&
                  year !== cursor.year &&
                  "ring-1 ring-brand/50",
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    )
  } else if (view === "months") {
    body = (
      <div>
        <p className="px-3 pt-2 text-xs text-muted-foreground">
          {t("issuances.new.date.chooseMonth")}
        </p>
        <div className="grid grid-cols-3 gap-1 p-2">
          {monthNames.map((_, index) => {
            const name = shownMonthName(index).slice(0, 3)
            const first = toIso(cursor.year, index, 1)
            const last = toIso(cursor.year, index, 28)
            const disabled = Boolean(
              (max && first > max) || (min && last < min),
            )
            return (
              <button
                key={name}
                type="button"
                disabled={disabled}
                aria-pressed={index === cursor.month}
                onClick={() => {
                  setCursor((current) => ({ ...current, month: index }))
                  setFocusIso(toIso(cursor.year, index, 1))
                  guided.current = false
                  setView("days")
                }}
                className={cn(
                  "h-10 rounded-md text-sm hover:bg-muted disabled:opacity-30",
                  index === cursor.month &&
                    "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>
    )
  } else {
    const first = new Date(cursor.year, cursor.month, 1)
    const cells = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(
        cursor.year,
        cursor.month,
        1 - first.getDay() + index,
      )
      return {
        iso: dateToIso(date),
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.month,
      }
    })
    // A focus target must be on screen, otherwise Tab would skip the grid.
    const tabStop = cells.some(
      (cell) => cell.iso === focusIso && !outOfRange(cell.iso),
    )
      ? focusIso
      : (cells.find((cell) => cell.inMonth && !outOfRange(cell.iso))?.iso ?? "")
    body = (
      <div className="p-2">
        <div className="grid grid-cols-7 pb-1">
          {weekdayKeys.map((key) => (
            <span
              key={key}
              className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {t(key)}
            </span>
          ))}
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow-key navigation between the day buttons */}
        <div
          ref={gridRef}
          role="presentation"
          onKeyDown={onGridKeyDown}
          className="grid grid-cols-7 gap-y-0.5"
        >
          {cells.map((cell) => {
            const selected = cell.iso === value
            const disabled = outOfRange(cell.iso)
            return (
              <button
                key={cell.iso}
                type="button"
                data-iso={cell.iso}
                disabled={disabled}
                tabIndex={cell.iso === tabStop ? 0 : -1}
                aria-pressed={selected}
                aria-label={formatPaperDate(cell.iso)}
                onClick={() => onSelect(cell.iso)}
                className={cn(
                  "mx-auto flex size-9 items-center justify-center rounded-full text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-30",
                  !cell.inMonth && "text-muted-foreground/60",
                  cell.iso === today && !selected && "ring-1 ring-brand/60",
                  selected &&
                    "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const canPickToday = showToday && !outOfRange(today)
  return (
    <div>
      {header}
      {body}
      {canPickToday && view === "days" ? (
        <div className="flex border-t px-2 py-1.5">
          <button
            type="button"
            onClick={() => onSelect(today)}
            className="h-9 rounded-md px-3 text-sm font-medium text-brand hover:bg-muted"
          >
            {t("issuances.new.date.today")}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function clampIso(iso: string, min?: string, max?: string) {
  if (min && iso < min) return min
  if (max && iso > max) return max
  return iso
}

type DateFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
  min?: string
  max?: string
  placeholder?: string
  /** "years" opens the year list first, which suits birthdates. */
  startView?: "days" | "years"
  /** Show the "Today" shortcut. Turn off for birthdates. */
  showToday?: boolean
}

/**
 * A date box that shows "November 3, 2026" and opens a friendly calendar.
 * People can also just type the date. The stored value stays YYYY-MM-DD.
 */
export function DateField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  min,
  max,
  placeholder,
  startView = "days",
  showToday = true,
}: DateFieldProps) {
  const { t } = useTranslation()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState<string | null>(null)
  const [rejected, setRejected] = useState<"unreadable" | "outOfRange" | null>(
    null,
  )
  const hintId = `${id ?? "date"}-hint`
  const upward = useOpenUpward(open, wrapperRef, panelRef)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(open, wrapperRef, close)

  const isoValue = isIso(value) ? value : ""
  const display = isoValue ? formatPaperDate(isoValue) : ""

  // Focusing the box opens the calendar, so a deliberate refocus must not reopen it.
  const skipFocusOpen = useRef(false)
  function refocus() {
    skipFocusOpen.current = true
    inputRef.current?.focus()
    skipFocusOpen.current = false
  }

  function select(iso: string) {
    onChange(iso)
    setRejected(null)
    setTyped(null)
    setOpen(false)
    refocus()
  }

  function onType(text: string) {
    setTyped(text)
    setRejected(null)
    const parsed = parseLooseDate(text)
    if (parsed && !(min && parsed < min) && !(max && parsed > max)) {
      onChange(parsed)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) setOpen(true)
      else
        panelRef.current
          ?.querySelector<HTMLElement>(
            "button[tabindex='0'], [data-anchor='true']",
          )
          ?.focus()
    } else if (event.key === "Escape" && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    } else if (event.key === "Enter") {
      // Enter confirms a typed date instead of submitting the whole form.
      event.preventDefault()
      event.stopPropagation()
      if (typed !== null) setTyped(null)
      setOpen(false)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: closes the calendar when focus leaves the whole control
    <div
      ref={wrapperRef}
      role="presentation"
      className="relative min-w-0"
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        if (next && !wrapperRef.current?.contains(next)) setOpen(false)
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        value={typed ?? display}
        placeholder={placeholder ?? t("issuances.new.date.choose")}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id ?? "date"}-calendar` : undefined}
        aria-invalid={invalid || rejected ? true : undefined}
        aria-describedby={
          [describedBy, rejected ? hintId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onFocus={() => {
          if (!skipFocusOpen.current) setOpen(true)
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => onType(event.target.value)}
        onBlur={() => {
          const text = typed?.trim() ?? ""
          if (text) {
            const parsed = parseLooseDate(text)
            if (!parsed) setRejected("unreadable")
            else if ((min && parsed < min) || (max && parsed > max))
              setRejected("outOfRange")
            else setRejected(null)
          }
          setTyped(null)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          formControlClass,
          "pr-10",
          (invalid || rejected) && "border-destructive",
        )}
      />
      {rejected ? (
        <p id={hintId} className="mt-1 text-xs text-destructive">
          {rejected === "unreadable"
            ? t("issuances.new.date.unreadable")
            : t("issuances.new.date.outOfRange")}
        </p>
      ) : null}
      <button
        type="button"
        tabIndex={-1}
        aria-label={
          open
            ? t("issuances.new.date.closeCalendar")
            : t("issuances.new.date.openCalendar")
        }
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) setOpen(false)
          else {
            inputRef.current?.focus()
            setOpen(true)
          }
        }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={`${id ?? "date"}-calendar`}
          role="dialog"
          aria-label={t("issuances.new.date.calendar")}
          data-popover-open="true"
          onMouseDown={(event) => {
            // Keep the text box focused unless a real control inside needs focus.
            if (!(event.target as HTMLElement).closest("button"))
              event.preventDefault()
          }}
          className={cn(
            panelClass,
            "w-[19rem] max-w-[calc(100vw-2rem)]",
            upward ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <Calendar
            value={isoValue}
            min={min}
            max={max}
            startView={startView}
            showToday={showToday}
            onSelect={select}
            onDone={() => {
              setOpen(false)
              refocus()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
