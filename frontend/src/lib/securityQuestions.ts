// The fixed list of recovery questions. The wording lives in the language
// files under securityQuestions.catalog.<id>; only the ids go to the server.
// Keep in step with QUESTION_IDS in backend/app/core/security_questions.py.
export const SECURITY_QUESTION_IDS = [
  "q01",
  "q02",
  "q03",
  "q04",
  "q05",
  "q06",
  "q07",
  "q08",
  "q09",
  "q10",
] as const

export type SecurityQuestionId = (typeof SECURITY_QUESTION_IDS)[number]

export const SECURITY_QUESTIONS_REQUIRED = 3
