import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { formControlClass } from "@/components/Common/formStyles"
import { formatPaperDate, isoToLocalDate, localDateToIso, monthNames } from "@/lib/issuance-format"
import { cn } from "@/lib/utils"

type DateFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
  help?: string
  minYear?: number
  maxYear?: number
  noFuture?: boolean
}

function localDateValue() {
  return localDateToIso(new Date())
}

function dateAtMonth(year: number, month: number) {
  return new Date(year, month, 1)
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

export function DateField({
  id,
  label,
  value,
  onChange,
  required = false,
  error,
  help,
  minYear,
  maxYear,
  noFuture = false,
}: DateFieldProps) {
  const today = localDateValue()
  const todayDate = isoToLocalDate(today) ?? new Date()
  const selectedDate = isoToLocalDate(value)
  const isBirthdate = label.toLowerCase().includes("birthdate")
  const effectiveMinYear = minYear ?? 1
  const effectiveMaxYear = Math.min(maxYear ?? todayDate.getFullYear() + 1, noFuture ? todayDate.getFullYear() : Number.MAX_SAFE_INTEGER)
  const initialViewDate = selectedDate ?? (isBirthdate
    ? new Date(todayDate.getFullYear() - 30, todayDate.getMonth(), todayDate.getDate())
    : todayDate)
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initialViewDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialViewDate.getMonth())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const yearOptions = useMemo(
    () => Array.from({ length: Math.max(1, effectiveMaxYear - effectiveMinYear + 1) }, (_, index) => effectiveMinYear + index),
    [effectiveMinYear, effectiveMaxYear],
  )
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const calendarDays = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInCurrentMonth }, (_, index) => index + 1),
  ]
  const minDate = `${String(effectiveMinYear).padStart(4, "0")}-01-01`
  const maxDate = noFuture
    ? today
    : `${String(effectiveMaxYear).padStart(4, "0")}-12-31`
  const rangeMessage = selectedDate && (selectedDate.getFullYear() < effectiveMinYear || selectedDate.getFullYear() > effectiveMaxYear)
    ? `Year must be between ${effectiveMinYear} and ${effectiveMaxYear}.`
    : ""
  const futureMessage = noFuture && value && value > today ? "Date cannot be in the future." : ""
  const invalidMessage = rangeMessage || futureMessage
  const describedBy = [
    error ? `${id}-error` : "",
    help ? `${id}-help` : "",
    invalidMessage ? `${id}-range-error` : "",
  ].filter(Boolean).join(" ") || undefined

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [open])

  function openCalendar() {
    const nextDate = selectedDate ?? initialViewDate
    setViewYear(nextDate.getFullYear())
    setViewMonth(nextDate.getMonth())
    setOpen((previous) => !previous)
  }

  function chooseDate(date: Date) {
    const nextValue = localDateToIso(date)
    if (nextValue < minDate || nextValue > maxDate) return
    onChange(nextValue)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function changeMonth(nextMonth: number) {
    const nextDate = dateAtMonth(viewYear, nextMonth)
    setViewYear(nextDate.getFullYear())
    setViewMonth(nextDate.getMonth())
  }

  function chooseToday() {
    if (today < minDate || today > maxDate) return
    onChange(today)
    setViewYear(todayDate.getFullYear())
    setViewMonth(todayDate.getMonth())
    setOpen(false)
    triggerRef.current?.focus()
  }

  const showTodayLink = id === "field-date" || label.toLowerCase() === "date on document"

  return (
    <div className="relative min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}{required ? <span className="text-destructive"> *</span> : null}
      </label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-calendar` : undefined}
        aria-invalid={Boolean(error || invalidMessage)}
        aria-describedby={describedBy}
        onClick={openCalendar}
        className={cn(
          formControlClass,
          "flex w-full items-center justify-between gap-2 text-left",
          (error || invalidMessage) && "border-destructive",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value ? formatPaperDate(value) : isBirthdate ? "Select birthdate" : "Select date"}</span>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div
          ref={popoverRef}
          id={`${id}-calendar`}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute left-0 top-full z-[100] mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <select
              aria-label="Month"
              value={viewMonth}
              onChange={(event) => changeMonth(Number(event.target.value))}
              className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm"
            >
              {monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}
            </select>
            <button
              type="button"
              aria-label="Previous month"
              disabled={viewYear === effectiveMinYear && viewMonth === 0}
              onClick={() => changeMonth(viewMonth - 1)}
              className="inline-flex size-9 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <select
              aria-label="Year"
              value={viewYear}
              onChange={(event) => setViewYear(Number(event.target.value))}
              className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm"
            >
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />
              const date = new Date(viewYear, viewMonth, day)
              const iso = localDateToIso(date)
              const disabled = iso < minDate || iso > maxDate
              const selected = selectedDate ? isSameDay(date, selectedDate) : false
              const isToday = isSameDay(date, todayDate)
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  onClick={() => chooseDate(date)}
                  className={cn(
                    "size-9 rounded-md text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
                    selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    isToday && !selected && "border border-primary/50 font-semibold",
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
          {showTodayLink ? (
            <div className="mt-3 flex justify-end border-t pt-2">
              <button type="button" onClick={chooseToday} className="min-h-9 px-2 text-sm font-medium text-primary underline underline-offset-4">Today</button>
            </div>
          ) : null}
        </div>
      ) : null}
      {help ? <p id={`${id}-help`} className="text-xs font-normal text-muted-foreground">{help}</p> : null}
      {error ? <p id={`${id}-error`} className="text-xs font-normal text-destructive">{error}</p> : null}
      {invalidMessage ? <p id={`${id}-range-error`} className="text-xs font-normal text-destructive">{invalidMessage}</p> : null}
    </div>
  )
}
