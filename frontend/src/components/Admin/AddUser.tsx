import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { type UserCreateByAdmin, UsersService } from "@/client"
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
  DialogTrigger,
} from "@/components/ui/dialog"
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
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const buildSchema = (t: TFunction) =>
  z.object({
    email: z.email({ message: t("admin.users.form.validation.email") }),
    full_name: z.string().optional(),
    // Existing API role flag. A pending/rejected workflow needs a separate backend status field.
    is_superuser: z.boolean(),
    is_active: z.boolean(),
  })

type FormData = z.infer<ReturnType<typeof buildSchema>>

const AddUser = () => {
  const { t } = useTranslation()
  const formSchema = useMemo(() => buildSchema(t), [t])
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      full_name: "",
      is_superuser: false,
      is_active: false,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: UserCreateByAdmin) =>
      UsersService.createUser({ body: data }),
    onSuccess: () => {
      showSuccessToast(t("admin.users.notifications.created"))
      form.reset()
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const onSubmit = (data: FormData) => {
    // No password is sent: the account starts with the default password.
    // is_superuser is the existing API field for the System Administrator role.
    mutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-11">
          <Plus className="mr-2" />
          {t("admin.users.form.addButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className={`${modalShell} sm:max-w-2xl`}>
        <DialogHeader className={modalHeader}>
          <DialogTitle className="text-xl">
            {t("admin.users.form.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.users.form.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className={`${modalBody} grid gap-4 sm:grid-cols-2`}>
              <p className="rounded-md border border-brand/20 bg-brand/10 px-3 py-2 text-sm text-foreground sm:col-span-2">
                {t("admin.users.form.tempNotice", {
                  password: DEFAULT_PASSWORD,
                })}
              </p>
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

              <FormField
                control={form.control}
                name="is_superuser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.users.form.role")}</FormLabel>
                    <FormControl>
                      <Select
                        className={formControlClass}
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
                  <FormItem className="flex min-h-11 items-center gap-3 space-y-0 self-end rounded-md border bg-background px-3 sm:mb-0">
                    <FormControl>
                      <Checkbox
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
      </DialogContent>
    </Dialog>
  )
}

export default AddUser
