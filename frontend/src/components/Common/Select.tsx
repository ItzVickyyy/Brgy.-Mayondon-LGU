import {
  type ButtonHTMLAttributes,
  Children,
  Fragment,
  isValidElement,
  type ReactNode,
} from "react"
import {
  type ChoiceOption,
  SelectField,
} from "@/components/Issuances/NewIssuance/FormControls"

/** What `onChange` receives: the same `event.target.value` a native select gives. */
export type SelectChangeEvent = {
  target: { value: string }
  currentTarget: { value: string }
}

type SelectProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onChange" | "children"
> & {
  value: string | number
  onChange?: (event: SelectChangeEvent) => void
  /** `<option>` elements, exactly as for a native `<select>`. */
  children: ReactNode
  /** Classes for the box around the button, for example a fixed width. */
  wrapperClassName?: string
  /** Search box on or off. By default it shows for 5 or more choices. */
  searchable?: boolean
  /** Always open the list above the button. */
  openUp?: boolean
  required?: boolean
  placeholder?: string
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (isValidElement(node))
    return textOf((node.props as { children?: ReactNode }).children)
  return ""
}

function collectOptions(children: ReactNode, into: ChoiceOption[]) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const props = child.props as {
      children?: ReactNode
      value?: string | number
      disabled?: boolean
    }
    if (child.type === Fragment) {
      collectOptions(props.children, into)
    } else if (child.type === "option") {
      const label = textOf(props.children)
      into.push({
        value: props.value === undefined ? label : String(props.value),
        label,
        disabled: props.disabled,
      })
    }
  })
}

/**
 * Drop-in replacement for the browser's `<select>`: same `value`, `onChange`
 * (read `event.target.value`) and `<option>` children, but it looks and works
 * like the dropdown in the New Issuance form (search box from 5 choices, arrow
 * keys, Esc, type-ahead, 44 px touch target, dark mode).
 */
export function Select({
  value,
  onChange,
  children,
  className,
  wrapperClassName,
  searchable,
  openUp,
  required,
  placeholder,
  id,
  disabled,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...rest
}: SelectProps) {
  const options: ChoiceOption[] = []
  collectOptions(children, options)
  return (
    <SelectField
      id={id}
      value={String(value)}
      onChange={(next) =>
        onChange?.({ target: { value: next }, currentTarget: { value: next } })
      }
      options={options}
      placeholder={placeholder}
      invalid={ariaInvalid === true || ariaInvalid === "true"}
      disabled={disabled}
      describedBy={describedBy}
      className={className}
      wrapperClassName={wrapperClassName}
      searchable={searchable}
      openUp={openUp}
      floating
      required={required}
      ariaLabel={ariaLabel}
      triggerProps={rest}
    />
  )
}
