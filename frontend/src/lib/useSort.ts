import { useCallback, useState } from "react"

/**
 * Click-to-sort for one table (patch 292). Each sortable column has an
 * accessor that returns the value to compare. Clicking a heading cycles
 * ascending -> descending -> back to the original order.
 *
 * Server-paged tables still on this hook (Barangay IDs, Issuance History)
 * sort only the rows on the page being shown; tables that hold the whole list
 * (Officials, Backup, User Accounts) sort the full list before it is split
 * into pages. Empty values always go last.
 *
 * The Activity Log (314) and Records and Archived (315) use `useServerSort`: it only reports which
 * column and direction were chosen, the endpoint sorts the whole result
 * (`sort_by`, `sort_dir`) and the page shows its rows as they arrive.
 */
export type SortValue = string | number | null | undefined
export type SortDir = "asc" | "desc"
type SortState = { key: string; dir: SortDir } | null

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

const isEmpty = (value: SortValue) =>
  value === null || value === undefined || value === ""

export function useSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => SortValue>,
) {
  const [state, setState] = useState<SortState>(null)

  const toggle = useCallback((key: string) => {
    setState((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" }
      return current.dir === "asc" ? { key, dir: "desc" } : null
    })
  }, [])

  const accessor = state ? accessors[state.key] : undefined
  let sorted = rows
  if (state && accessor) {
    const sign = state.dir === "asc" ? 1 : -1
    sorted = rows
      .map((row, index) => ({ row, index, value: accessor(row) }))
      .sort((a, b) => {
        const aEmpty = isEmpty(a.value)
        const bEmpty = isEmpty(b.value)
        if (aEmpty || bEmpty) {
          if (aEmpty && bEmpty) return a.index - b.index
          return aEmpty ? 1 : -1
        }
        const order =
          typeof a.value === "number" && typeof b.value === "number"
            ? a.value - b.value
            : collator.compare(String(a.value), String(b.value))
        return order ? order * sign : a.index - b.index
      })
      .map((entry) => entry.row)
  }

  return {
    sorted,
    /** Changes whenever the order changes (use as a pagination reset key). */
    key: state ? `${state.key}:${state.dir}` : "",
    toggle,
    isSortable: (column: string) => column in accessors,
    dirOf: (column: string): SortDir | null =>
      state && state.key === column ? state.dir : null,
    ariaSort: (
      column: string,
    ): "ascending" | "descending" | "none" | undefined => {
      if (!(column in accessors)) return undefined
      if (!state || state.key !== column) return "none"
      return state.dir === "asc" ? "ascending" : "descending"
    },
  }
}

/**
 * Heading clicks for a table whose server does the sorting (314). `columns`
 * maps a heading to the server's sort column; the click cycle is the same as
 * `useSort` (ascending, descending, back to the server's default order).
 * `by` and `dir` go into the query and its key; `key` resets pagination.
 */
export function useServerSort(columns: Record<string, string>) {
  const [state, setState] = useState<SortState>(null)

  const toggle = useCallback((key: string) => {
    setState((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" }
      return current.dir === "asc" ? { key, dir: "desc" } : null
    })
  }, [])

  return {
    by: state ? columns[state.key] : undefined,
    dir: state?.dir ?? "asc",
    key: state ? `${state.key}:${state.dir}` : "",
    toggle,
    isSortable: (column: string) => column in columns,
    dirOf: (column: string): SortDir | null =>
      state && state.key === column ? state.dir : null,
    ariaSort: (
      column: string,
    ): "ascending" | "descending" | "none" | undefined => {
      if (!(column in columns)) return undefined
      if (!state || state.key !== column) return "none"
      return state.dir === "asc" ? "ascending" : "descending"
    },
  }
}

export type SortApi = Pick<
  ReturnType<typeof useSort>,
  "toggle" | "isSortable" | "dirOf" | "ariaSort"
>
