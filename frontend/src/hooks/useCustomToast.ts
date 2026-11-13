import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { notify } from "@/lib/notifications"

const useCustomToast = () => {
  const { t } = useTranslation()

  // A success message is also kept in the bell in the top bar (it keeps the
  // language it was written in). Pass `{ keep: false }` for tiny feedback that
  // is not worth keeping, such as "copied". Callers must not put resident
  // names or server error text in `description`.
  const showSuccessToast = (
    description: string,
    options?: { keep?: boolean },
  ) => {
    if (options?.keep === false) {
      toast.success(t("common.toast.success"), { description })
      return
    }
    notify(description, "success", { toastTitle: t("common.toast.success") })
  }

  const showErrorToast = (description: string) => {
    toast.error(t("common.toast.error"), {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
