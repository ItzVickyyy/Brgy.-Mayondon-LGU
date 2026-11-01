type UserRoleSource =
  | {
      is_superuser?: boolean | null
    }
  | null
  | undefined

/**
 * Maps the current API authorization flag to the prototype's role model.
 * The backend must still enforce every permission for protected API actions.
 */
export function isSystemAdministrator(user: UserRoleSource): boolean {
  return Boolean(user?.is_superuser)
}
