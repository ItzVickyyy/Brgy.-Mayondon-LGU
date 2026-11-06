// Friendly wording for activity-log entries, shared by the Dashboard and the
// Activity Log page so both show the same titles.

const activityTitles: Record<string, string> = {
  "resident.create": "Resident added",
  "resident.update": "Resident updated",
  "resident.archive": "Resident archived",
  "resident.restore": "Resident restored",
  "resident.photo_set": "Resident photo added",
  "resident.photo_remove": "Resident photo removed",
  "issuance.issue": "Document issued",
  "issuance.correct": "Correction started",
  "issuance.void": "Document voided",
  "issuance.view_sensitive": "Restricted detail viewed",
  "official.create": "Official added",
  "official.update": "Official updated",
  "user.create": "Account created",
  "user.update": "Account updated",
  "user.role_change": "Account role changed",
  "user.password_change": "Password changed",
  "user.update_self": "Own account updated",
  "user.delete": "Account deleted",
  "user.delete_self": "Own account deleted",
}

export function activityTitle(action: string) {
  if (activityTitles[action]) return activityTitles[action]
  const words = action.replace(/[._]/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
