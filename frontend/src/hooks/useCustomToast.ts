import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// Toasts are immediate feedback for the person who just acted. They are NOT
// kept anywhere: the bell in the top bar holds only curated notices (see
// `lib/notifications.ts`), never a copy of every toast.
const useCustomToast = () => {
  const { t } = useTranslation()

  const showSuccessToast = (description: string) => {
    toast.success(t("common.toast.success"), {
      description,
    })
  }

  const showErrorToast = (description: string) => {
    toast.error(t("common.toast.error"), {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
