export const randomEmail = () =>
  `test_${Math.random().toString(36).substring(7)}@example.com`

export const randomTeamName = () =>
  `Team ${Math.random().toString(36).substring(7)}`

export const randomPassword = () =>
  `Test-${Math.random().toString(36).substring(2)}-Password123!`

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")

export const randomItemTitle = () =>
  `Item ${Math.random().toString(36).substring(7)}`

export const randomItemDescription = () =>
  `Description ${Math.random().toString(36).substring(7)}`

// A name that passes the resident rules (letters only, patch 251): the same time-based
// number as before, with each digit written as a letter.
export const letterTag = (prefix: string) =>
  prefix +
  String(Date.now() % 1000000).replace(
    /\d/g,
    (digit) => "abcdefghij"[Number(digit)],
  )
