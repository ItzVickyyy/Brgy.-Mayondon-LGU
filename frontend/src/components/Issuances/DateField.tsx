import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { formControlClass } from "@/components/Common/formStyles"
import { buildIsoDate, daysInMonth, monthNames, splitIsoDate } from "@/lib/issuance-format"
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
  showToday?: boolean
}

function localDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
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
  showToday = false,
}: DateFieldProps) {
  const initial = splitIsoDate(value)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [day, setDay] = useState(initial.day)
  const lastEmittedValue = useRef<string | null>(null)
  const today = localDateValue()
  const effectiveMinYear = minYear ?? 1
  const effectiveMaxYear = maxYear ?? new Date().getFullYear() + 1

  useEffect(() => {
    if (lastEmittedValue.current === value) {
      lastEmittedValue.current = null
      return
    }
    const parts = splitIsoDate(value)
    setYear(parts.year)
    setMonth(parts.month)
    setDay(parts.day)
  }, [value])

  const numericYear = /^\d{4}$/.test(year) ? Number(year) : 0
  const numericMonth = Number(month)
  const effectiveYear = numericYear || new Date().getFullYear()
  const maxDay = numericMonth ? daysInMonth(effectiveYear, numericMonth) : 31
  const dayOptions = useMemo(() => Array.from({ length: maxDay }, (_, index) => String(index + 1)), [maxDay])
  const isoValue = buildIsoDate(year, month, day)
  const rangeMessage = year.length === 4 && numericYear && (numericYear < effectiveMinYear || numericYear > effectiveMaxYear)
    ? `Year must be between ${effectiveMinYear} and ${effectiveMaxYear}.`
    : ""
  const futureMessage = noFuture && isoValue && isoValue > today ? "Date cannot be in the future." : ""
  const invalidMessage = rangeMessage || futureMessage
  const describedBy = [error ? `${id}-error` : "", help ? `${id}-help` : "", invalidMessage ? `${id}-range-error` : ""].filter(Boolean).join(" ") || undefined

  function emitDate(nextYear: string, nextMonth: string, nextDay: string) {
    const nextIso = buildIsoDate(nextYear, nextMonth, nextDay)
    const validYear = Number(nextYear) >= effectiveMinYear && Number(nextYear) <= effectiveMaxYear
    const validFuture = !noFuture || !nextIso || nextIso <= today
    const emittedValue = nextIso && validYear && validFuture ? nextIso : ""
    lastEmittedValue.current = emittedValue
    onChange(emittedValue)
  }

  function chooseToday() {
    const parts = splitIsoDate(today)
    setYear(parts.year)
    setMonth(parts.month)
    setDay(parts.day)
    onChange(today)
  }

  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-sm font-medium">{label}{required ? <span className="text-destructive"> *</span> : null}</legend>
      <div className="grid min-w-0 grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-2">
        <div className="min-w-0">
          <label htmlFor={id} className="sr-only">Month</label>
          <select
            id={id}
            required={required}
            value={month}
            onChange={(event) => {
              const nextMonth = event.target.value
              const nextMaxDay = nextMonth ? daysInMonth(effectiveYear, Number(nextMonth)) : 31
              const nextDay = day && Number(day) > nextMaxDay ? "" : day
              setMonth(nextMonth)
              setDay(nextDay)
              emitDate(year, nextMonth, nextDay)
            }}
            className={cn(formControlClass, "min-w-0 px-2", (error || invalidMessage) && "border-destructive")}
            aria-invalid={Boolean(error || invalidMessage)}
            aria-describedby={describedBy}
          >
            <option value="">Month</option>
            {monthNames.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-day`} className="sr-only">Day</label>
          <select
            id={`${id}-day`}
            value={day}
            onChange={(event) => {
              setDay(event.target.value)
              emitDate(year, month, event.target.value)
            }}
            className={cn(formControlClass, "min-w-0 px-2", (error || invalidMessage) && "border-destructive")}
            aria-invalid={Boolean(error || invalidMessage)}
            aria-describedby={describedBy}
          >
            <option value="">Day</option>
            {dayOptions.map((number) => <option key={number} value={number}>{number}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-year`} className="sr-only">Year</label>
          <input
            id={`${id}-year`}
            inputMode="numeric"
            maxLength={4}
            value={year}
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault() }}
            onChange={(event) => {
              const nextYear = event.target.value.replace(/\D/g, "").slice(0, 4)
              const nextMonth = month
              const nextYearForDays = nextYear.length === 4 ? Number(nextYear) : new Date().getFullYear()
              const nextDay = day && nextMonth && Number(day) > daysInMonth(nextYearForDays, Number(nextMonth)) ? "" : day
              setYear(nextYear)
              setDay(nextDay)
              emitDate(nextYear, nextMonth, nextDay)
            }}
            placeholder="Year"
            className={cn(formControlClass, "min-w-0 px-2", (error || invalidMessage) && "border-destructive")}
            aria-invalid={Boolean(error || invalidMessage)}
            aria-describedby={describedBy}
          />
        </div>
      </div>
      {showToday ? <Button type="button" variant="ghost" size="sm" className="min-h-11 px-2" onClick={chooseToday}>Today</Button> : null}
      {help ? <p id={`${id}-help`} className="text-xs font-normal text-muted-foreground">{help}</p> : null}
      {error ? <p id={`${id}-error`} className="text-xs font-normal text-destructive">{error}</p> : null}
      {invalidMessage ? <p id={`${id}-range-error`} className="text-xs font-normal text-destructive">{invalidMessage}</p> : null}
    </fieldset>
  )
}
