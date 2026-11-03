import { CalendarDays, Check, ChevronDown } from "lucide-react"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { formControlClass } from "@/components/Common/formStyles"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPaperDate } from "@/lib/issuance-format"
import { cn } from "@/lib/utils"

export type ChoiceOption = string | { value: string; label: string }

function optionValue(option: ChoiceOption) {
  return typeof option === "string" ? option : option.value
}
function optionLabel(option: ChoiceOption) {
  return typeof option === "string" ? option : option.label
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
}

/** Styled dropdown that replaces the browser's default <select>. */
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
}: SelectFieldProps) {
  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full bg-background text-sm data-[size=default]:h-11",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={4}
        className="max-h-72 rounded-lg p-0.5 shadow-lg"
      >
        {options.map((option) => (
          <SelectItem
            key={optionValue(option)}
            value={optionValue(option)}
            className="min-h-10 rounded-md py-2 pr-9 pl-3 text-sm"
          >
            {optionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
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
}

/** Shows the date as "November 3, 2026". The browser's calendar opens when it is clicked. */
export function DateField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  min,
  max,
  placeholder = "Choose a date",
}: DateFieldProps) {
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""
  const display = isoValue ? formatPaperDate(isoValue) : ""
  function openPicker(input: HTMLInputElement) {
    try {
      input.showPicker?.()
    } catch {
      // Some browsers only allow the picker from a direct click. Typing still works.
    }
  }
  return (
    <span
      className={cn(
        formControlClass,
        "relative flex items-center justify-between gap-2 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
        invalid && "border-destructive",
      )}
    >
      <span className={cn("truncate", !display && "text-muted-foreground")}>
        {display || placeholder}
      </span>
      <CalendarDays
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={id}
        type="date"
        value={isoValue}
        min={min}
        max={max}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => openPicker(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPicker(event.currentTarget)
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  )
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

type BirthdateFieldProps = {
  value: string
  onChange: (value: string) => void
  idPrefix?: string
  /** Id for the first control, so "Missing" links can focus it. */
  firstId?: string
}

function daysIn(month: number, year: number) {
  if (!month) return 31
  return new Date(year || 2000, month, 0).getDate()
}

/** Month, day and year in one row. Easier than a calendar for dates many years back. */
export function BirthdateField({
  value,
  onChange,
  idPrefix = "birthdate",
  firstId,
}: BirthdateFieldProps) {
  const [yy = "", mm = "", dd = ""] = value ? value.split("-") : []
  const [parts, setParts] = useState({
    year: yy,
    month: mm ? String(Number(mm)) : "",
    day: dd ? String(Number(dd)) : "",
  })

  // Keep in step when the value is changed from outside (for example after a reset).
  useEffect(() => {
    if (!value) return
    const [y = "", m = "", d = ""] = value.split("-")
    setParts({ year: y, month: String(Number(m)), day: String(Number(d)) })
  }, [value])
  useEffect(() => {
    if (!value) setParts({ year: "", month: "", day: "" })
  }, [value])

  function commit(next: { year: string; month: string; day: string }) {
    setParts(next)
    const year = Number(next.year)
    const month = Number(next.month)
    const day = Number(next.day)
    if (
      next.year.length === 4 &&
      year >= 1900 &&
      month &&
      day &&
      day <= daysIn(month, year)
    ) {
      onChange(
        `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      )
    } else if (value) {
      onChange("")
    }
  }

  const dayCount = daysIn(Number(parts.month), Number(parts.year))
  return (
    <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)] gap-2">
      <SelectField
        id={firstId ?? `${idPrefix}-month`}
        value={parts.month}
        onChange={(month) => commit({ ...parts, month })}
        options={monthNames.map((name, index) => ({
          value: String(index + 1),
          label: name,
        }))}
        placeholder="Month"
      />
      <SelectField
        id={`${idPrefix}-day`}
        value={parts.day}
        onChange={(day) => commit({ ...parts, day })}
        options={Array.from({ length: dayCount }, (_, index) =>
          String(index + 1),
        )}
        placeholder="Day"
      />
      <input
        id={`${idPrefix}-year`}
        inputMode="numeric"
        maxLength={4}
        placeholder="Year"
        aria-label="Year"
        value={parts.year}
        onChange={(event) =>
          commit({ ...parts, year: event.target.value.replace(/\D/g, "") })
        }
        className={formControlClass}
      />
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
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const query = value.trim().toLowerCase()
  const exact = options.some((option) => option.toLowerCase() === query)
  const shown =
    !query || exact
      ? options
      : options.filter((option) => option.toLowerCase().includes(query))

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

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
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-0.5 text-popover-foreground shadow-lg"
        >
          {shown.map((option, index) => (
            <div
              key={option}
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
              <span>{option}</span>
              {option === value ? <Check className="size-4" /> : null}
            </div>
          ))}
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
        variant === "box" && checked && "border-primary bg-primary/5",
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
        className="size-5 rounded-md border-2 border-muted-foreground/50 bg-background data-[state=checked]:border-primary [&_svg]:size-4"
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
                "border-primary bg-primary/10 font-medium text-primary hover:bg-primary/10",
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
