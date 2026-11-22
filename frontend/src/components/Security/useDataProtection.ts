import { useQuery } from "@tanstack/react-query"

import { SystemService } from "@/client"

/**
 * Whether the key that protects saved health conditions is in place (System Administrator only;
 * patch 214). Counts only, never a value. Re-read every five minutes and after the page is opened
 * again, so the reminder goes away soon after the key is added.
 */
export function useDataProtection(enabled: boolean) {
  return useQuery({
    queryKey: ["system-data-protection"],
    queryFn: async () => (await SystemService.readDataProtection()).data,
    enabled,
    retry: false,
    staleTime: 60_000,
    refetchInterval: 300_000,
    refetchIntervalInBackground: false,
  })
}
