import { useSyncExternalStore } from "react"
import { toast } from "sonner"

import i18n from "@/i18n"

// Every notice the app shows (saved, archived, backup made, ...) is also kept
// here so it can be read again from the bell in the top bar. The list lives in
// this browser only, per signed-in account, and keeps the newest 50 notices for
// at most 30 days. Do not put resident names or other personal details in a
// stored notice: pass them as `toastText` so they show on screen only.

const MAX_NOTIFICATIONS = 50
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const STORAGE_PREFIX = "notifications:"

export type NotificationInput =
  | string
  // A translation key follows a language switch; plain text does not.
  | { key: string; values?: Record<string, string | number> }

export type NotificationItem = {
  id: string
  // Either a translation key (with values) or the finished text.
  key?: string
  values?: Record<string, string | number>
  message?: string
  createdAt: number
  read: boolean
}

let owner: string | null = null
let items: NotificationItem[] = []
const EMPTY: NotificationItem[] = []
// One object per change, so the list and the account it belongs to are read
// together and can never be out of step.
let snapshot: { owner: string | null; items: NotificationItem[] } = {
  owner: null,
  items: EMPTY,
}
const listeners = new Set<() => void>()

function storageKey(id: string) {
  return `${STORAGE_PREFIX}${id}`
}

function isItem(value: unknown): value is NotificationItem {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "number" &&
    typeof item.read === "boolean" &&
    (typeof item.key === "string" || typeof item.message === "string")
  )
}

function fresh(list: NotificationItem[]): NotificationItem[] {
  const oldest = Date.now() - MAX_AGE_MS
  return list.filter((item) => item.createdAt >= oldest)
}

function load(id: string): NotificationItem[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey(id)) ?? "[]",
    )
    return Array.isArray(parsed) ? fresh(parsed.filter(isItem)) : []
  } catch {
    return []
  }
}

function emit() {
  snapshot = { owner, items }
  for (const listener of listeners) listener()
}

function commit(next: NotificationItem[]) {
  items = fresh(next).slice(0, MAX_NOTIFICATIONS)
  if (owner) {
    try {
      localStorage.setItem(storageKey(owner), JSON.stringify(items))
    } catch {
      // Storage can be full or blocked; the list then lasts for this visit only.
    }
  }
  emit()
}

/** Called by the app layout once it knows who is signed in. */
export function setNotificationOwner(id: string | null) {
  if (id === owner) return
  owner = id
  items = id ? load(id) : []
  emit()
}

export function notificationText(item: NotificationItem): string {
  if (item.key) {
    // Keys are stored as plain text, so they bypass the typed key list.
    const translate = i18n.t as unknown as (
      key: string,
      values?: object,
    ) => string
    return translate(item.key, item.values)
  }
  return item.message ?? ""
}

/**
 * Saves a notice in the bell and shows it briefly on screen. `toastText`, when
 * given, is what the on-screen toast says (it may name a resident); only
 * `input` is stored.
 */
export function notify(
  input: NotificationInput,
  tone: "success" | "warning" = "success",
  options?: { toastText?: string },
) {
  const entry: NotificationItem =
    typeof input === "string"
      ? { id: "", message: input, createdAt: 0, read: false }
      : { id: "", ...input, createdAt: 0, read: false }
  const item: NotificationItem = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  }
  commit([item, ...items])
  const text = options?.toastText ?? notificationText(item)
  if (tone === "warning") toast.warning(text)
  else toast.success(text)
}

export function markNotificationRead(id: string) {
  if (!items.some((item) => item.id === id && !item.read)) return
  commit(items.map((item) => (item.id === id ? { ...item, read: true } : item)))
}

export function markAllNotificationsRead() {
  if (!items.some((item) => !item.read)) return
  commit(items.map((item) => ({ ...item, read: true })))
}

export function clearNotifications() {
  if (items.length === 0) return
  commit([])
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * `ownerId` is the account that is signed in right now. The list is shown only
 * while the stored list belongs to that account, so a notice of the previous
 * account is never drawn, not even for one render.
 */
export function useNotifications(ownerId: string | null) {
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
  const list =
    ownerId !== null && current.owner === ownerId ? current.items : EMPTY
  return {
    notifications: list,
    unreadCount: list.filter((item) => !item.read).length,
  }
}
