import { useQuery } from "@tanstack/react-query"

import { SystemService } from "@/client"

export const UPDATE_STATUS_KEY = ["system-update"] as const

/**
 * What the office computer's update service reports (System Administrator only).
 * The program cannot update itself: the computer looks for a new approved version, installs it
 * at night, and installs it at once when an administrator presses Update (see
 * `scripts/update-watcher.ps1`). `fast` is for the open Update dialog, which follows the update
 * every few seconds; otherwise the notice is refreshed every two minutes while the page is visible.
 */
export function useUpdateStatus(enabled: boolean, fast = false) {
  return useQuery({
    queryKey: UPDATE_STATUS_KEY,
    queryFn: async () => (await SystemService.readUpdateStatus()).data,
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchInterval: fast ? 4_000 : 120_000,
    refetchIntervalInBackground: false,
  })
}
