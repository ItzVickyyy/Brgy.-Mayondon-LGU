import { createFileRoute, redirect } from "@tanstack/react-router"

import { UsersService } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import { pageTitle } from "@/config/site"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/change-password")({
  component: ForcedPasswordChange,
  beforeLoad: async () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" })

    let mustChangePassword = false
    try {
      const response = await UsersService.readUserMe()
      mustChangePassword = response.data.must_change_password === true
    } catch (error) {
      if (error && typeof error === "object" && "status" in error) {
        const status = error.status
        if (status === 401 || status === 403) {
          localStorage.removeItem("access_token")
          throw redirect({ to: "/login" })
        }
      }
      throw error
    }

    if (!mustChangePassword) throw redirect({ to: "/" })
  },
  head: () => ({ meta: [{ title: pageTitle("Change Password") }] }),
})

function ForcedPasswordChange() {
  return (
    <AuthLayout>
      <ChangePassword forced />
    </AuthLayout>
  )
}
