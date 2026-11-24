import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import {
  type Body_login_login_access_token as AccessToken,
  type LoginResult,
  LoginService,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "@/client"
import { endSession } from "@/lib/endSession"
import {
  CURRENT_USER_KEY,
  clearCurrentUser,
  currentUserQueryOptions,
} from "@/lib/queryClient"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  // One shared answer (see lib/queryClient.ts): the route guard and every component that asks
  // "who is signed in" read the same cached /users/me for a minute.
  const { data: user, error: userError } = useQuery<UserPublic, Error>({
    ...currentUserQueryOptions,
    enabled: isLoggedIn(),
  })

  useEffect(() => {
    if (!userError || !("status" in userError)) return

    const status = userError.status
    if (status === 401 || status === 403) {
      localStorage.removeItem("access_token")
      clearCurrentUser()
      navigate({ to: "/login", replace: true })
    }
  }, [userError, navigate])

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ body: data }),
    onSuccess: () => {
      navigate({ to: "/login" })
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  // A person with two-factor on gets only a short ``mfa_token`` here; the
  // access token comes from the second step (``verifyMfaMutation``).
  const finishSignIn = (result: LoginResult) => {
    if (!result.access_token) return false
    // A new sign-in must never show the previous person's cached details.
    queryClient.removeQueries({ queryKey: CURRENT_USER_KEY })
    localStorage.setItem("access_token", result.access_token)
    return true
  }

  const login = async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      body: data,
    })
    const result = response.data
    return {
      signedIn: finishSignIn(result),
      mfaToken: result.mfa_required ? (result.mfa_token ?? null) : null,
    }
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: ({ signedIn }) => {
      if (signedIn) {
        showSuccessToast(t("common.toast.signedIn"))
        navigate({ to: "/" })
      }
    },
    onError: handleError.bind(showErrorToast),
  })

  const verifyMfaMutation = useMutation({
    mutationFn: async (data: { mfaToken: string; code: string }) => {
      const response = await LoginService.loginMfa({
        body: { mfa_token: data.mfaToken, code: data.code },
      })
      return finishSignIn(response.data)
    },
    onSuccess: (signedIn) => {
      if (signedIn) {
        showSuccessToast(t("common.toast.signedIn"))
        navigate({ to: "/" })
      }
    },
  })

  const logout = () => {
    endSession()
    clearCurrentUser()
    queryClient.removeQueries({ queryKey: ["notifications"] })
    navigate({ to: "/login" })
    showSuccessToast(t("common.toast.signedOut"))
  }

  return {
    signUpMutation,
    loginMutation,
    verifyMfaMutation,
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth
