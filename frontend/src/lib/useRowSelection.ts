import { useCallback, useEffect, useMemo, useState } from "react"

/**
 * Batch selection for one table (patch 278). `rows` is what the table shows
 * now (one page, or the whole list); `getId` gives each row a stable id.
 * Selected ids survive a change of page and are dropped when the row is no
 * longer in `knownIds` (so a deleted or filtered-out row is never acted on).
 */
export function useRowSelection<T>(
  rows: T[],
  getId: (row: T) => string,
  knownIds?: string[],
) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const pageIds = useMemo(() => rows.map(getId), [rows, getId])
  const known = knownIds ?? pageIds
  const knownKey = known.join("|")

  // biome-ignore lint/correctness/useExhaustiveDependencies: knownKey is the trigger.
  useEffect(() => {
    setSelected((current) => {
      const live = new Set(known)
      const next = new Set([...current].filter((id) => live.has(id)))
      return next.size === current.size ? current : next
    })
  }, [knownKey])

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length
  const allOnPage = pageIds.length > 0 && selectedOnPage === pageIds.length
  const someOnPage = selectedOnPage > 0 && !allOnPage

  const togglePage = useCallback(() => {
    setSelected((current) => {
      const next = new Set(current)
      if (pageIds.length > 0 && pageIds.every((id) => next.has(id))) {
        for (const id of pageIds) next.delete(id)
      } else {
        for (const id of pageIds) next.add(id)
      }
      return next
    })
  }, [pageIds])

  const clear = useCallback(() => setSelected(new Set()), [])

  return {
    selected,
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    togglePage,
    clear,
    allOnPage,
    someOnPage,
    pick: (list: T[]) => list.filter((row) => selected.has(getId(row))),
  }
}

export type RowSelection = ReturnType<typeof useRowSelection>
