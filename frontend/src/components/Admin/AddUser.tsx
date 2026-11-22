import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import {
  type UserCreateByAdmin,
  type UserCreated,
  UsersService,
} from "@/client"
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
  FormDescription,
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

// Endings the server's address check refuses (reserved names). Any other
// well-formed address is accepted, whether or not it really exists.
const RESERVED_ENDINGS = [
  ".arpa",
  ".invalid",
  ".local",
  ".localhost",
  ".onion",
  ".test",
]

const buildSchema = (t: TFunction) =>
  z.object({
    email: z
      .email({ message: t("admin.users.form.validation.email") })
      .refine(
        (value) =>
          !RESERVED_ENDINGS.some((ending) =>
            value.toLowerCase().endsWith(ending),
          ),
        { message: t("admin.users.form.validation.emailReserved") },
      ),
    first_name: z
      .string()
      .trim()
      .min(1, { message: t("admin.users.form.validation.firstName") }),
    middle_name: z.string().optional(),
    last_name: z
      .string()
      .trim()
      .min(1, { message: t("admin.users.form.validation.lastName") }),
    extension_name: z.string().optional(),
    // Existing API role flag. A pending/rejected workflow needs a separate backend status field.
    is_superuser: z.boolean(),
    is_active: z.boolean(),
  })

type FormData = z.infer<ReturnType<typeof buildSchema>>

const AddUser = () => {
  const { t } = useTranslation()
  const formSchema = useMemo(() => buildSchema(t), [t])
  const [isOpen, setIsOpen] = useState(false)
  // Set when the default password could not be emailed: it is shown once.
  const [handOver, setHandOver] = useState<UserCreated | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      extension_name: "",
      is_superuser: false,
      is_active: true,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: UserCreateByAdmin) =>
      (await UsersService.createUser({ body: data })).data,
    onSuccess: (created: UserCreated) => {
      form.reset()
      if (created.password_emailed) {
        showSuccessToast(
          t("admin.users.notifications.createdEmailed", {
            email: created.email,
          }),
        )
        setIsOpen(false)
      } else {
        setHandOver(created)
      }
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const closeDialog = (open: boolean) => {
    setIsOpen(open)
    if (!open) setHandOver(null)
  }

  const onSubmit = (data: FormData) => {
    // No password is sent: the account starts with the default password.
    // is_superuser is the existing API field for the System Administrator role.
    mutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={closeDialog}>
      <DialogTrigger asChild>
        <Button variant="cta" size="cta">
          <Plus aria-hidden="true" />
          {t("admin.users.form.addButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className={`${modalShell} sm:max-w-3xl`}>
        {handOver ? (
          <>
            <DialogHeader className={modalHeader}>
              <DialogTitle className="text-xl">
                {t("admin.users.form.createdTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("admin.users.form.createdNotEmailed", {
                  name: handOver.full_name || handOver.email,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className={`${modalBody} grid gap-3`} data-testid="hand-over">
              <div className="rounded-md border border-brand/20 bg-brand/10 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {t("admin.users.form.defaultPasswordLabel")}
                </p>
                <p
                  className="select-all font-mono text-xl font-semibold tracking-wide text-foreground"
                  data-testid="default-password"
                >
                  {DEFAULT_PASSWORD}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("admin.users.form.createdOnce")}
              </p>
            </div>
            <DialogFooter className={modalFooter}>
              <Button
                className="min-h-11"
                type="button"
                onClick={() => closeDialog(false)}
              >
                {t("admin.users.form.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
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
                    {t("admin.users.form.addNotice")}
                  </p>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>
                          {t("admin.users.form.email")}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("admin.users.form.emailPlaceholder")}
                            type="email"
                            maxLength={255}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t("admin.users.form.emailHint")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Full name on one row: first, middle, last and a narrow
                      extension (Jr., III). Stacks on a phone. On wider screens each
                      field spans three shared rows (label, input, message) so a
                      label that wraps in Filipino cannot push its input down. */}
                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,9rem)] sm:grid-rows-[auto_auto_auto]">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem className="sm:row-span-3 sm:grid-rows-subgrid sm:gap-y-2 sm:[&>label]:self-end">
                          <FormLabel>
                            {t("account.fields.firstName")}{" "}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("account.placeholders.firstName")}
                              type="text"
                              maxLength={100}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="middle_name"
                      render={({ field }) => (
                        <FormItem className="sm:row-span-3 sm:grid-rows-subgrid sm:gap-y-2 sm:[&>label]:self-end">
                          <FormLabel>
                            {t("account.fields.middleName")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("account.placeholders.middleName")}
                              type="text"
                              maxLength={100}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem className="sm:row-span-3 sm:grid-rows-subgrid sm:gap-y-2 sm:[&>label]:self-end">
                          <FormLabel>
                            {t("account.fields.lastName")}{" "}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("account.placeholders.lastName")}
                              type="text"
                              maxLength={100}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="extension_name"
                      render={({ field }) => (
                        <FormItem className="sm:row-span-3 sm:grid-rows-subgrid sm:gap-y-2 sm:[&>label]:self-end">
                          <FormLabel>
                            {t("account.fields.extensionName")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                "account.placeholders.extensionName",
                              )}
                              type="text"
                              maxLength={20}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Role and Is active: the box sits in the same row as the
                      select, not at the bottom of the select's message space. */}
                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto] sm:gap-y-2">
                    <FormField
                      control={form.control}
                      name="is_superuser"
                      render={({ field }) => (
                        <FormItem className="sm:row-span-3 sm:grid-rows-subgrid sm:gap-y-2">
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
                        <FormItem className="flex min-h-11 min-w-0 flex-row items-center gap-3 space-y-0 rounded-md border bg-background px-3 py-2 sm:col-start-2 sm:row-start-2">
                          <FormControl>
                            <Checkbox
                              className="shrink-0"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="min-w-0 flex-1 cursor-pointer font-normal leading-snug">
                            {t("admin.users.form.isActive")}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AddUser
