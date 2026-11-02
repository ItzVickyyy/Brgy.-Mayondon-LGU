import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EllipsisVertical, UserRoundX, UserRoundCheck } from "lucide-react"
import { useState } from "react"

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
import EditUser from "./EditUser"

type UserActionData = UserPublic & {
  isCurrentUser: boolean
  isLastActiveAdmin: boolean
}

interface UserActionsMenuProps {
  user: UserActionData
}

export const UserActionsMenu = ({ user }: UserActionsMenuProps) => {
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
      showSuccessToast(variables.active ? "User account reactivated" : "User account deactivated")
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
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={`More actions for ${user.full_name || user.email}`}>
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <EditUser
            user={user}
            protectRoleAndStatus={user.isLastActiveAdmin}
            onSuccess={() => setOpen(false)}
          />
          <DropdownMenuItem
            disabled={user.is_active && user.isLastActiveAdmin}
            title={user.is_active && user.isLastActiveAdmin ? "Cannot deactivate the last active System Administrator" : undefined}
            onSelect={() => setPendingActive(!user.is_active)}
          >
            {user.is_active ? <UserRoundX aria-hidden="true" /> : <UserRoundCheck aria-hidden="true" />}
            {user.is_active ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={pendingActive !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingActive(null)
        }}
        title={pendingActive ? "Reactivate user account?" : "Deactivate user account?"}
        description={
          pendingActive
            ? `Reactivate ${user.full_name || user.email}'s account so they can sign in again?`
            : `Deactivate ${user.full_name || user.email}'s account? Their existing records and issuance history will remain.`
        }
        confirmLabel={pendingActive ? "Reactivate account" : "Deactivate account"}
        destructive={pendingActive === false}
        onConfirm={() => {
          if (pendingActive === null) return
          statusMutation.mutate({ active: pendingActive })
        }}
      />
    </>
  )
}
