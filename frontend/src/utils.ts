import { AxiosError } from "axios"

import i18n from "@/i18n"

function extractErrorMessage(err: Error): string {
  if (err instanceof AxiosError) {
    const errDetail = (err.response?.data as { detail?: unknown } | undefined)?.detail
    if (Array.isArray(errDetail) && errDetail.length > 0) {
      const first = errDetail[0] as { msg?: unknown }
      return typeof first.msg === "string" ? first.msg : i18n.t("apiErrors.requestFailed")
    }
    if (typeof errDetail === "string") return errDetail
    if (err.response?.status === 403) return i18n.t("apiErrors.forbidden")
    return err.message || i18n.t("apiErrors.generic")
  }
  return i18n.t("apiErrors.generic")
}

export const handleError = function (this: (msg: string) => void, err: Error) {
  this(extractErrorMessage(err))
}

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
