import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EllipsisVertical, UserRoundCheck, UserRoundX } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { type UserPublic, UsersService } from "@/client"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import DeleteUser from "./DeleteUser"
import EditUser from "./EditUser"

type UserActionData = UserPublic & {
  isCurrentUser: boolean
  isLastActiveAdmin: boolean
}

interface UserActionsMenuProps {
  user: UserActionData
}

export const UserActionsMenu = ({ user }: UserActionsMenuProps) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pendingActive, setPendingActive] = useState<boolean | null>(null)
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const statusMutation = useMutation({
    mutationFn: ({ active }: { active: boolean }) =>
      UsersService.updateUser({
        path: { user_id: user.id },
        body: { is_active: active },
      }),
    onSuccess: (_result, variables) => {
      showSuccessToast(
        variables.active
          ? t("admin.users.notifications.reactivated")
          : t("admin.users.notifications.deactivated"),
      )
      setPendingActive(null)
      setOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  if (user.id === currentUser?.id) return null

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <EditUser
          user={user}
          asPrimaryButton
          protectRoleAndStatus={user.isLastActiveAdmin}
          onSuccess={() => setOpen(false)}
        />
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={t("admin.users.actions.moreFor", { name: user.full_name || user.email })}
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DeleteUser id={user.id} onSuccess={() => setOpen(false)} />
            <DropdownMenuItem
              disabled={user.is_active && user.isLastActiveAdmin}
              title={
                user.is_active && user.isLastActiveAdmin
                  ? t("admin.users.actions.cannotDeactivateLast")
                  : undefined
              }
              onSelect={() => setPendingActive(!user.is_active)}
            >
              {user.is_active ? (
                <UserRoundX aria-hidden="true" />
              ) : (
                <UserRoundCheck aria-hidden="true" />
              )}
              {user.is_active ? t("admin.users.actions.deactivate") : t("admin.users.actions.reactivate")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={pendingActive !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingActive(null)
        }}
        title={pendingActive ? t("admin.users.actions.reactivateTitle") : t("admin.users.actions.deactivateTitle")}
        description={
          pendingActive
            ? t("admin.users.actions.reactivateDescription", { name: user.full_name || user.email })
            : t("admin.users.actions.deactivateDescription", { name: user.full_name || user.email })
        }
        confirmLabel={pendingActive ? t("admin.users.actions.reactivateConfirm") : t("admin.users.actions.deactivateConfirm")}
        destructive={pendingActive === false}
        onConfirm={() => {
          if (pendingActive === null) return
          statusMutation.mutate({ active: pendingActive })
        }}
      />
    </>
  )
}
