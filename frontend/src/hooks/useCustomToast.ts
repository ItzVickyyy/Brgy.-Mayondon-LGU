import { toast } from "sonner"

// Toasts are immediate feedback for the person who just acted. They are NOT
// kept anywhere: the bell in the top bar holds only curated notices (see
// `lib/notifications.ts`), never a copy of every toast. A toast is one short
// line: the icon and the colored edge already say success or error.
const useCustomToast = () => {
  const showSuccessToast = (message: string) => {
    toast.success(message, { duration: 3000 })
  }

  const showErrorToast = (message: string) => {
    // Errors stay longer: there is something to read and possibly act on.
    toast.error(message, { duration: 6000 })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
