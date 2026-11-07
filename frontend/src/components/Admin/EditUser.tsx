import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import type { TFunction } from "i18next"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type UserPublic, UsersService } from "@/client"
import { formControlClass } from "@/components/Common/formStyles"
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
import useCustomToast from "@/hooks/useCustomToast"
import useAuth from "@/hooks/useAuth"
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
    // Existing API role flag. Do not treat is_active as pending/rejected status.
    is_superuser: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => !data.password || data.password === data.confirm_password, {
    message: t("admin.users.form.validation.mismatch"),
    path: ["confirm_password"],
  })

type FormData = z.infer<ReturnType<typeof buildSchema>>

interface EditUserProps {
  user: UserPublic
  onSuccess: () => void
  protectRoleAndStatus?: boolean
  asPrimaryButton?: boolean
}

const EditUser = ({ user, onSuccess, protectRoleAndStatus = false, asPrimaryButton = false }: EditUserProps) => {
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
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      UsersService.updateUser({ path: { user_id: user.id }, body: data }),
    onSuccess: () => {
      showSuccessToast("User updated successfully")
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
    if (!submitData.password) {
      delete submitData.password
    }
    // Preserve the selected role instead of forcing every account to Admin.
    mutation.mutate(submitData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {asPrimaryButton ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
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
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{t("admin.users.form.editTitle")}</DialogTitle>
              <DialogDescription>
                {t("admin.users.form.editDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!isEditingSelf ? (
                <p className="rounded-md border border-brand/20 bg-brand/10 px-3 py-2 text-sm text-foreground">
                  {t("admin.users.form.tempNotice")}
                </p>
              ) : null}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.users.form.email")} <span className="text-destructive">*</span>
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
                      <Input placeholder={t("admin.users.form.fullNamePlaceholder")} type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isEditingSelf ? t("admin.users.form.setPassword") : t("admin.users.form.tempPasswordLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("admin.users.form.passwordPlaceholder")}
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
                    <FormLabel>{t("admin.users.form.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("admin.users.form.passwordPlaceholder")}
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
                name="is_superuser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.role")}</FormLabel>
                    <FormControl>
                      <select
                        className={formControlClass}
                        disabled={protectRoleAndStatus}
                        value={field.value ? "admin" : "staff"}
                        onChange={(event) =>
                          field.onChange(event.target.value === "admin")
                        }
                      >
                        <option value="staff">{t("admin.users.roleStaff")}</option>
                        <option value="admin">{t("admin.users.roleAdmin")}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        disabled={protectRoleAndStatus}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{t("admin.users.form.isActive")}</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="min-h-11" disabled={mutation.isPending}>
                  {t("admin.users.form.cancel")}
                </Button>
              </DialogClose>
              <LoadingButton className="min-h-11" type="submit" loading={mutation.isPending}>
                {t("admin.users.form.save")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditUser
