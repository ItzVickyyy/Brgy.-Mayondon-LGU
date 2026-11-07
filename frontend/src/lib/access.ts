type UserRoleSource =
  | {
      role?: "admin" | "staff" | null
      is_superuser?: boolean | null
    }
  | null
  | undefined

/**
 * Maps the API account role to the prototype's role model.
 * `role` is the source of truth; `is_superuser` is the legacy flag the API still
 * sends and is only used if `role` is missing. This only decides what the UI
 * shows: the backend enforces every permission itself.
 */
export function isSystemAdministrator(user: UserRoleSource): boolean {
  if (user?.role) return user.role === "admin"
  return Boolean(user?.is_superuser)
}
