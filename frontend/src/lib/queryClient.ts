/**
 * The one shared data cache for the whole app (patch 237), and the one place that knows how to
 * read "who is signed in".
 *
 * `/users/me` used to be fetched three times on every page load (the layout guard, the layout and
 * the sidebar each asked on their own). They now share one answer that stays fresh for a minute.
 * The answer is thrown away on sign-in, sign-out and any 401/403, so one person never sees
 * another person's data.
 */
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { AxiosError } from "axios"

import { type UserPublic, UsersService } from "@/client"

export const CURRENT_USER_KEY = ["currentUser"] as const

/** The server refused the token because the same account signed in on another computer. */
export function isSignedInElsewhere(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false
  const data = error.response?.data as
    | { detail?: { code?: string } }
    | undefined
  return data?.detail?.code === "signed_in_elsewhere"
}

const handleApiError = (error: Error) => {
  if (isSignedInElsewhere(error)) {
    localStorage.removeItem("access_token")
    window.location.href = "/login?elsewhere=1"
    return
  }
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { detail?: { code?: string } }
      | undefined
    // These two 403s mean "do one more step", not "you are signed out".
    const code = responseData?.detail?.code
    if (code === "password_change_required") return
    if (code === "password_confirmation_required") return
  }

  if (
    error instanceof AxiosError &&
    [401, 403].includes(error.response?.status ?? 0)
  ) {
    localStorage.removeItem("access_token")
    window.location.href = "/login"
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})

export const currentUserQueryOptions = {
  queryKey: CURRENT_USER_KEY,
  queryFn: async (): Promise<UserPublic> =>
    (await UsersService.readUserMe()).data,
  staleTime: 60_000,
  retry: false,
} as const

/**
 * The signed-in user for the route guards: the shared answer when it is under a minute old,
 * otherwise a fresh read that is stored for everyone else. Someone who still has to change a
 * temporary password is always read fresh, so the page never sends them back to the password
 * form after they have changed it.
 *
 * The read is made directly, not through the cache's own fetch, on purpose: a 401/403 must reach
 * the route guard (which signs out and redirects inside the app) and not the cache's global error
 * handler (which reloads the whole page).
 */
export async function loadCurrentUser(): Promise<UserPublic> {
  const cached = queryClient.getQueryData<UserPublic>(CURRENT_USER_KEY)
  const updatedAt = queryClient.getQueryState(CURRENT_USER_KEY)?.dataUpdatedAt
  const fresh =
    cached !== undefined &&
    cached.must_change_password !== true &&
    cached.password_expired !== true &&
    updatedAt !== undefined &&
    Date.now() - updatedAt < currentUserQueryOptions.staleTime
  if (fresh) return cached
  const me = (await UsersService.readUserMe()).data
  queryClient.setQueryData(CURRENT_USER_KEY, me)
  return me
}

/** Forget who was signed in (sign-in, sign-out, 401/403). */
export function clearCurrentUser(): void {
  queryClient.removeQueries({ queryKey: CURRENT_USER_KEY })
}
