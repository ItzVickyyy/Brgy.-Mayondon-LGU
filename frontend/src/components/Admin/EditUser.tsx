import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { Pencil } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import {
  SecurityQuestionsService,
  TwoFactorService,
  type UserPublic,
  UsersService,
} from "@/client"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { formControlClass } from "@/components/Common/formStyles"
import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Select } from "@/components/Common/Select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { DEFAULT_PASSWORD } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const buildSchema = (t: TFunction) =>
  z
    .object({
      email: z.email({ message: t("admin.users.form.validation.email") }),
      full_name: z.string().optional(),
      password: z
        .string()
        .min(12, { message: t("admin.users.form.validation.passwordMin") })
        .optional()
        .or(z.literal("")),
      confirm_password: z.string().optional(),
      reset_to_default_password: z.boolean().optional(),
      unlock: z.boolean().optional(),
      // Existing API role flag. Do not treat is_active as pending/rejected status.
      is_superuser: z.boolean().optional(),
      is_active: z.boolean().optional(),
    })
    .refine(
      (data) => !data.password || data.password === data.confirm_password,
      {
        message: t("admin.users.form.validation.mismatch"),
        path: ["confirm_password"],
      },
    )

type FormData = z.infer<ReturnType<typeof buildSchema>>

interface EditUserProps {
  user: UserPublic
  onSuccess: () => void
  protectRoleAndStatus?: boolean
  asPrimaryButton?: boolean
}

const EditUser = ({
  user,
  onSuccess,
  protectRoleAndStatus = false,
  asPrimaryButton = false,
}: EditUserProps) => {
  const { t } = useTranslation()
  const formSchema = useMemo(() => buildSchema(t), [t])
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { user: currentUser } = useAuth()
  const isEditingSelf = currentUser?.id === user.id

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: user.email,
      full_name: user.full_name ?? undefined,
      is_superuser: user.is_superuser,
      is_active: user.is_active,
      reset_to_default_password: false,
      unlock: false,
    },
  })

  const [clearOpen, setClearOpen] = useState(false)
  const questionsKey = ["security-questions", "user", user.id]
  const questionsStatus = useQuery({
    queryKey: questionsKey,
    queryFn: async () =>
      (
        await SecurityQuestionsService.questionsReadUserSecurityQuestions({
          path: { user_id: user.id },
        })
      ).data,
    enabled: isOpen && !isEditingSelf,
  })
  const clearQuestions = useMutation({
    mutationFn: () =>
      SecurityQuestionsService.questionsClearUserSecurityQuestions({
        path: { user_id: user.id },
      }),
    onSuccess: () => {
      showSuccessToast(t("securityQuestions.admin.cleared"))
      queryClient.invalidateQueries({ queryKey: questionsKey })
    },
    onError: handleError.bind(showErrorToast),
  })

  const [mfaResetOpen, setMfaResetOpen] = useState(false)
  const mfaKey = ["mfa", "user", user.id]
  const mfaStatus = useQuery({
    queryKey: mfaKey,
    queryFn: async () =>
      (
        await TwoFactorService.factorReadUserMfa({
          path: { user_id: user.id },
        })
      ).data,
    enabled: isOpen && !isEditingSelf,
  })
  const setMfaRequired = useMutation({
    mutationFn: (required: boolean) =>
      TwoFactorService.factorSetUserMfaRequired({
        path: { user_id: user.id },
        body: { required },
      }),
    onSuccess: (_data, required) => {
      showSuccessToast(
        required ? t("twoFactor.admin.asked") : t("twoFactor.admin.stopped"),
      )
      queryClient.invalidateQueries({ queryKey: mfaKey })
    },
    onError: handleError.bind(showErrorToast),
  })
  const resetMfa = useMutation({
    mutationFn: () =>
      TwoFactorService.factorResetUserMfa({ path: { user_id: user.id } }),
    onSuccess: () => {
      showSuccessToast(t("twoFactor.admin.reset"))
      queryClient.invalidateQueries({ queryKey: mfaKey })
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      UsersService.updateUser({ path: { user_id: user.id }, body: data }),
    onSuccess: () => {
      showSuccessToast(t("admin.users.notifications.updated"))
      setIsOpen(false)
      onSuccess()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const onSubmit = (data: FormData) => {
    // exclude confirm_password from submission data and remove password if empty
    const { confirm_password: _, ...submitData } = data
    if (!submitData.password || !isEditingSelf) {
      delete submitData.password
    }
    if (isEditingSelf || !submitData.reset_to_default_password) {
      delete submitData.reset_to_default_password
    }
    if (isEditingSelf || !user.locked_until || !submitData.unlock) {
      delete submitData.unlock
    }
    // Preserve the selected role instead of forcing every account to Admin.
    mutation.mutate(submitData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {asPrimaryButton ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
        >
          <Pencil aria-hidden="true" />
          {t("admin.users.form.edit")}
        </Button>
      ) : (
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={() => setIsOpen(true)}
        >
          <Pencil />
          {t("admin.users.form.editTitle")}
        </DropdownMenuItem>
      )}
      <DialogContent className={`${modalShell} sm:max-w-2xl`}>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <DialogHeader className={modalHeader}>
              <DialogTitle className="text-xl">
                {t("admin.users.form.editTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("admin.users.form.editDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className={`${modalBody} grid gap-4 sm:grid-cols-2`}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.users.form.email")}{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("admin.users.form.emailPlaceholder")}
                        type="email"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.fullName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("admin.users.form.fullNamePlaceholder")}
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditingSelf ? (
                <>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {isEditingSelf
                            ? t("admin.users.form.setPassword")
                            : t("admin.users.form.tempPasswordLabel")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t(
                              "admin.users.form.passwordPlaceholder",
                            )}
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirm_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("admin.users.form.confirmPassword")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t(
                              "admin.users.form.passwordPlaceholder",
                            )}
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  {user.locked_until && (
                    <FormField
                      control={form.control}
                      name="unlock"
                      render={({ field }) => (
                        <FormItem className="flex min-h-11 items-start gap-3 space-y-0 rounded-md border bg-background px-3 py-2 sm:col-span-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {t("admin.users.form.unlockAccount")}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  )}
                  <div
                    className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 sm:col-span-2"
                    data-testid="user-security-questions"
                  >
                    <span className="text-sm">
                      {t("securityQuestions.admin.label")}:{" "}
                      <strong>
                        {questionsStatus.data?.configured
                          ? t("securityQuestions.admin.set")
                          : t("securityQuestions.admin.notSet")}
                      </strong>
                    </span>
                    {questionsStatus.data?.configured ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 sm:min-h-8"
                        onClick={() => setClearOpen(true)}
                      >
                        {t("securityQuestions.admin.clear")}
                      </Button>
                    ) : null}
                  </div>
                  <div
                    className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 sm:col-span-2"
                    data-testid="user-mfa"
                  >
                    <span className="text-sm">
                      {t("twoFactor.admin.label")}:{" "}
                      <strong>
                        {mfaStatus.data?.enabled
                          ? t("twoFactor.admin.on")
                          : t("twoFactor.admin.off")}
                      </strong>
                    </span>
                    {mfaStatus.data?.enabled && !user.is_superuser ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 sm:min-h-8"
                        onClick={() => setMfaResetOpen(true)}
                      >
                        {t("twoFactor.admin.turnOff")}
                      </Button>
                    ) : null}
                    {mfaStatus.data?.enabled && user.is_superuser ? (
                      <span className="basis-full text-xs text-muted-foreground">
                        {t("twoFactor.admin.adminNote")}
                      </span>
                    ) : null}
                    {mfaStatus.data &&
                    !user.is_superuser &&
                    user.role !== "admin" ? (
                      <div
                        className="flex basis-full flex-wrap items-center justify-between gap-2 border-t pt-2"
                        data-testid="user-mfa-required"
                      >
                        <span className="text-sm">
                          {t("twoFactor.admin.askedLabel")}:{" "}
                          <strong>
                            {mfaStatus.data.required
                              ? t("twoFactor.admin.yes")
                              : t("twoFactor.admin.no")}
                          </strong>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 sm:min-h-8"
                          disabled={setMfaRequired.isPending}
                          onClick={() =>
                            setMfaRequired.mutate(!mfaStatus.data.required)
                          }
                        >
                          {mfaStatus.data.required
                            ? t("twoFactor.admin.stopAsking")
                            : t("twoFactor.admin.ask")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <FormField
                    control={form.control}
                    name="reset_to_default_password"
                    render={({ field }) => (
                      <FormItem className="flex min-h-11 items-start gap-3 space-y-0 rounded-md border bg-background px-3 py-2 sm:col-span-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t("admin.users.form.resetToDefault", {
                            password: DEFAULT_PASSWORD,
                          })}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="is_superuser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.role")}</FormLabel>
                    <FormControl>
                      <Select
                        className={formControlClass}
                        disabled={protectRoleAndStatus}
                        value={field.value ? "admin" : "staff"}
                        onChange={(event) =>
                          field.onChange(event.target.value === "admin")
                        }
                      >
                        <option value="staff">
                          {t("admin.users.roleStaff")}
                        </option>
                        <option value="admin">
                          {t("admin.users.roleAdmin")}
                        </option>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex min-h-11 items-center gap-3 space-y-0 self-end rounded-md border bg-background px-3">
                    <FormControl>
                      <Checkbox
                        disabled={protectRoleAndStatus}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      {t("admin.users.form.isActive")}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className={modalFooter}>
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={mutation.isPending}
                >
                  {t("admin.users.form.cancel")}
                </Button>
              </DialogClose>
              <LoadingButton
                className="min-h-11"
                type="submit"
                loading={mutation.isPending}
              >
                {t("admin.users.form.save")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
        <ConfirmDialog
          open={clearOpen}
          onOpenChange={setClearOpen}
          title={t("securityQuestions.admin.confirmTitle")}
          description={t("securityQuestions.admin.confirmMessage", {
            name: user.full_name || user.email,
          })}
          confirmLabel={t("securityQuestions.admin.clear")}
          destructive
          onConfirm={() => {
            setClearOpen(false)
            clearQuestions.mutate()
          }}
        />
        <ConfirmDialog
          open={mfaResetOpen}
          onOpenChange={setMfaResetOpen}
          title={t("twoFactor.admin.confirmTitle")}
          description={t("twoFactor.admin.confirmMessage", {
            name: user.full_name || user.email,
          })}
          confirmLabel={t("twoFactor.admin.turnOff")}
          destructive
          onConfirm={() => {
            setMfaResetOpen(false)
            resetMfa.mutate()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

export default EditUser
