import { useQuery } from "@tanstack/react-query"

import { SecurityQuestionsService } from "@/client"

export const SECURITY_QUESTIONS_KEY = ["security-questions", "me"] as const

/** Whether the signed-in person has set their recovery questions. */
export function useSecurityQuestionsStatus(enabled = true) {
  return useQuery({
    queryKey: SECURITY_QUESTIONS_KEY,
    queryFn: async () => {
      const response =
        await SecurityQuestionsService.questionsReadMySecurityQuestions()
      return response.data
    },
    enabled,
    staleTime: 60_000,
  })
}
