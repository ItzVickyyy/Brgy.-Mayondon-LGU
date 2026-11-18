// Names taken from the signed-in account: the First-Time Jobseeker witness and
// the "Certified by (initials)" box.

export type UserNameParts = {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  extension_name?: string | null
  full_name?: string | null
  email?: string | null
}

const nameWords = (user: UserNameParts | null | undefined): string[] =>
  [
    user?.first_name,
    user?.middle_name,
    user?.last_name,
    user?.extension_name,
  ].flatMap((part) => (part ?? "").trim().split(/\s+/).filter(Boolean))

/** Full name as the server stores it for a witness: name parts, else full_name, else e-mail. */
export function userFullName(user: UserNameParts | null | undefined): string {
  const built = [
    user?.first_name,
    user?.middle_name,
    user?.last_name,
    user?.extension_name,
  ]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ")
  return built || (user?.full_name ?? "").trim() || (user?.email ?? "")
}

/**
 * First letter of every word in the first, middle, last and extension names,
 * upper case ("Vic John" / "Oboza" / "Salen" / "Jr." gives "VJOSJ").
 * Empty when the account has no name parts (it is never made from the e-mail).
 */
export function userInitials(user: UserNameParts | null | undefined): string {
  return nameWords(user)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join("")
    .slice(0, 50)
}
