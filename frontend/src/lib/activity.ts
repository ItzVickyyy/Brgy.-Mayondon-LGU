// Friendly wording for activity-log entries, shared by the Dashboard and the
// Activity Log page so both show the same titles. The text lives in the
// language files under "activity.actions".
import type { ParseKeys, TFunction } from "i18next"

const activityKeys = {
  "resident.create": "activity.actions.resident.create",
  "resident.update": "activity.actions.resident.update",
  "resident.archive": "activity.actions.resident.archive",
  "resident.restore": "activity.actions.resident.restore",
  "resident.photo_set": "activity.actions.resident.photo_set",
  "resident.photo_remove": "activity.actions.resident.photo_remove",
  "resident.view": "activity.actions.resident.view",
  "resident.list": "activity.actions.resident.list",
  "barangay_id.list": "activity.actions.barangay_id.list",
  "report.export": "activity.actions.report.export",
  "audit.prune": "activity.actions.audit.prune",
  "issuance.issue": "activity.actions.issuance.issue",
  "issuance.correct": "activity.actions.issuance.correct",
  "issuance.void": "activity.actions.issuance.void",
  "issuance.print": "activity.actions.issuance.print",
  "issuance.view_sensitive": "activity.actions.issuance.view_sensitive",
  "official.create": "activity.actions.official.create",
  "official.update": "activity.actions.official.update",
  "auth.login": "activity.actions.auth.login",
  "auth.login_failed": "activity.actions.auth.login_failed",
  "user.create": "activity.actions.user.create",
  "user.update": "activity.actions.user.update",
  "user.role_change": "activity.actions.user.role_change",
  "user.password_change": "activity.actions.user.password_change",
  "user.temp_password_set": "activity.actions.user.temp_password_set",
  "user.unlock": "activity.actions.user.unlock",
  "user.update_self": "activity.actions.user.update_self",
  "user.delete": "activity.actions.user.delete",
  "user.delete_self": "activity.actions.user.delete_self",
} as const satisfies Record<string, ParseKeys>

// Pass the `t` from useTranslation() so the title follows the language.
export function activityTitle(action: string, t: TFunction) {
  const key = (activityKeys as Record<string, ParseKeys>)[action]
  if (key) return t(key)
  // An action with no wording yet: show the code as plain words.
  const words = action.replace(/[._]/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
