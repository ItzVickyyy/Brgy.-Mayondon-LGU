import { useQuery } from "@tanstack/react-query"

import { TwoFactorService } from "@/client"

export const MFA_STATUS_KEY = ["mfa", "me"] as const

/** Whether the signed-in person has two-factor sign-in on. */
export function useMfaStatus(enabled = true) {
  return useQuery({
    queryKey: MFA_STATUS_KEY,
    queryFn: async () => (await TwoFactorService.factorReadMyMfa()).data,
    enabled,
    staleTime: 30_000,
  })
}
