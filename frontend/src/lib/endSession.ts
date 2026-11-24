/**
 * Tells the server this sign-in token is finished, so a copy of it stops working at once, then
 * forgets it in this browser. The browser part always happens; the server part is best effort
 * (it still runs while the page is being left) and never shows an error.
 */
import { clearAllResidentDrafts } from "@/lib/residentDraft"

const TOKEN_KEY = "access_token"

export function endSession(): void {
  let token: string | null = null
  try {
    token = localStorage.getItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
    clearAllResidentDrafts()
  } catch {
    // Storage blocked: nothing to end here.
  }
  if (!token) return
  try {
    void fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/login/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    }).catch(() => {})
  } catch {
    // The token is still gone from this browser and expires by itself.
  }
}
