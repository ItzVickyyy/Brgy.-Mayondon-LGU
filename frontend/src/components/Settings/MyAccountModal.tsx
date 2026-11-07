import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Save, ShieldCheck, Upload, UserRound } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { UsersService, type UserUpdateMe } from "@/client"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

type ProfileForm = {
  email: string
  first_name: string
  middle_name: string
  last_name: string
  extension_name: string
  sex: string
  civil_status: string
  birthdate: string
  birthplace: string
  phone_number: string
  address: string
  governing_lgu: string
  profile_photo_url: string
}

const profileFields: {
  key: keyof ProfileForm
  label: string
  type?: string
  placeholder?: string
}[] = [
  { key: "first_name", label: "account.fields.firstName", placeholder: "account.placeholders.firstName" },
  {
    key: "middle_name",
    label: "account.fields.middleName",
    placeholder: "account.placeholders.middleName",
  },
  { key: "last_name", label: "account.fields.lastName", placeholder: "account.placeholders.lastName" },
  {
    key: "extension_name",
    label: "account.fields.extensionName",
    placeholder: "account.placeholders.extensionName",
  },
  { key: "sex", label: "account.fields.sex", placeholder: "account.placeholders.sex" },
  {
    key: "civil_status",
    label: "account.fields.civilStatus",
    placeholder: "account.placeholders.civilStatus",
  },
  { key: "birthdate", label: "account.fields.birthdate", type: "date" },
  {
    key: "birthplace",
    label: "account.fields.birthplace",
    placeholder: "account.placeholders.birthplace",
  },
]

const contactFields: {
  key: keyof ProfileForm
  label: string
  type?: string
  placeholder?: string
}[] = [
  {
    key: "email",
    label: "account.fields.email",
    type: "email",
  },
  {
    key: "phone_number",
    label: "account.fields.phoneNumber",
    type: "tel",
    placeholder: "09XX XXX XXXX",
  },
  {
    key: "address",
    label: "account.fields.address",
    placeholder: "account.placeholders.address",
  },
]

function getProfileForm(user: any): ProfileForm {
  return {
    email: user?.email ?? "",
    first_name: user?.first_name ?? "",
    middle_name: user?.middle_name ?? "",
    last_name: user?.last_name ?? "",
    extension_name: user?.extension_name ?? "",
    sex: user?.sex ?? "",
    civil_status: user?.civil_status ?? "",
    birthdate: user?.birthdate ?? "",
    birthplace: user?.birthplace ?? "",
    phone_number: user?.phone_number ?? "",
    address: user?.address ?? "",
    governing_lgu: user?.governing_lgu ?? "",
    profile_photo_url: user?.profile_photo_url ?? "",
  }
}

function AccountField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium leading-5">
        {value || t("account.notProvided")}
      </p>
    </div>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function MyAccountModal({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [form, setForm] = useState<ProfileForm>(() => getProfileForm(user))
  const [previewPhoto, setPreviewPhoto] = useState(
    user?.profile_photo_url ?? "",
  )
  const [selectedPhotoName, setSelectedPhotoName] = useState("")
  const [isPhotoDragging, setIsPhotoDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [addressParts, setAddressParts] = useState(() => ({
    address_line: user?.address ?? "",
    purok_sitio: "",
    barangay: "",
    municipality_city: "",
    province: "",
    zip_code: "",
  }))

  useEffect(() => {
    const next = getProfileForm(user)
    setForm(next)
    setPreviewPhoto(next.profile_photo_url)
    setSelectedPhotoName("")
    setAddressParts({
      address_line: user?.address ?? "",
      purok_sitio: "",
      barangay: "",
      municipality_city: "",
      province: "",
      zip_code: "",
    })
    if (open) setIsEditing(false)
  }, [user, open])

  const updateField = (key: keyof ProfileForm, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    if (key === "profile_photo_url") setPreviewPhoto(value)
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) =>
      UsersService.updateUserMe({ body: data }),
    onSuccess: () => {
      showSuccessToast("My Account updated successfully")
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      queryClient.invalidateQueries()
    },
    onError: handleError.bind(showErrorToast),
  })

  const saveProfile = () => {
    const fullName = [
      form.first_name,
      form.middle_name,
      form.last_name,
      form.extension_name,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ")
    const formattedAddress = [
      addressParts.address_line,
      addressParts.purok_sitio,
      addressParts.barangay,
      addressParts.municipality_city,
      addressParts.province,
      addressParts.zip_code,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ")
    const payload = {
      ...form,
      address: formattedAddress,
      full_name: fullName || user?.full_name || "",
    }
    mutation.mutate(payload as unknown as UserUpdateMe)
  }

  const status = user?.is_active === false ? t("account.status.inactive") : t("account.status.active")
  const role = user?.is_superuser ? t("account.roles.admin") : t("account.roles.staff")
  const username = user?.username || user?.email || t("account.notProvided")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b bg-muted/20 px-5 py-4 text-left sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <UserRound className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">
                {t("account.myAccount.title")}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("account.myAccount.description")}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5 sm:p-7">
            {!isEditing ? (
              <>
                <section>
                  <SectionHeading
                    title={t("account.sections.information")}
                    description={t("account.sections.informationDescription")}
                  />
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border bg-muted/20 px-4 py-3.5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-2 xl:grid-cols-[0.8fr_1.25fr_1fr_1.7fr]">
                    <AccountField label={t("account.status.label")} value={status} />
                    <AccountField label={t("account.username")} value={username} />
                    <AccountField label={t("account.role")} value={role} />
                    <AccountField
                      label={t("account.governingLgu")}
                      value="Brgy. Mayondon Los Baños, Laguna"
                    />
                  </div>
                </section>
                <section>
                  <SectionHeading
                    title={t("account.sections.personal")}
                    description={t("account.sections.personalDescription")}
                  />
                  <div className="flex items-center gap-4 rounded-xl border bg-muted/10 p-4">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background text-muted-foreground">
                      {previewPhoto ? (
                        <img
                          src={previewPhoto}
                          alt={t("account.profilePhoto")}
                          className="size-full object-cover"
                          onError={() => setPreviewPhoto("")}
                        />
                      ) : (
                        <UserRound className="size-7" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {[
                          form.first_name,
                          form.middle_name,
                          form.last_name,
                          form.extension_name,
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                          user?.full_name ||
                          t("account.nameNotProvided")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("account.profilePhoto")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
                    {profileFields.map((field) => (
                      <AccountField
                        key={field.key}
                        label={t(field.label)}
                        value={form[field.key]}
                      />
                    ))}
                  </div>
                </section>
                <section>
                  <SectionHeading
                    title={t("account.sections.contact")}
                    description={t("account.sections.contactDescription")}
                  />
                  <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                    <AccountField label={t("account.fields.email")} value={form.email} />
                    <AccountField
                      label={t("account.fields.phoneNumber")}
                      value={form.phone_number}
                    />
                    <div className="sm:col-span-2">
                      <AccountField
                        label={t("account.residentialAddress")}
                        value={form.address}
                      />
                    </div>
                  </div>
                </section>
                <section>
                  <SectionHeading
                    title={t("account.sections.security")}
                    description={t("account.sections.securityDescription")}
                  />
                  <div className="flex items-center gap-3 rounded-xl border p-4 sm:p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <ShieldCheck className="size-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">
                        {t("account.passwordSignIn")}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("account.passwordManage")}
                      </p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section>
                  <SectionHeading
                    title={t("account.sections.information")}
                    description={t("account.sections.informationDescription")}
                  />
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border bg-muted/20 px-4 py-3.5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-2 xl:grid-cols-[0.8fr_1.25fr_1fr_1.7fr]">
                    <AccountField label={t("account.status.label")} value={status} />
                    <AccountField label={t("account.username")} value={username} />
                    <AccountField label={t("account.role")} value={role} />
                    <AccountField
                      label={t("account.governingLgu")}
                      value="Brgy. Mayondon Los Baños, Laguna"
                    />
                  </div>
                </section>

                <section>
                  <SectionHeading
                    title={t("account.sections.personal")}
                    description={t("account.sections.personalEditDescription")}
                  />
                  <div className="mb-4 rounded-xl border bg-muted/10 p-4 sm:p-5">
                    <Label
                      htmlFor="profile_photo_file"
                      className="mb-2 block text-xs font-medium"
                    >
                      {t("account.profilePhoto")}
                    </Label>
                    <label
                      htmlFor="profile_photo_file"
                      onDragOver={(event) => {
                        event.preventDefault()
                        setIsPhotoDragging(true)
                      }}
                      onDragLeave={() => setIsPhotoDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault()
                        setIsPhotoDragging(false)
                        const file = event.dataTransfer.files?.[0]
                        if (file?.type.startsWith("image/")) {
                          setPreviewPhoto(URL.createObjectURL(file))
                          setSelectedPhotoName(file.name)
                        }
                      }}
                      className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors sm:flex-row sm:text-left ${isPhotoDragging ? "border-brand bg-brand/5" : "border-muted-foreground/25 hover:border-brand/50 hover:bg-muted/30"}`}
                    >
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background text-muted-foreground shadow-sm">
                        {previewPhoto ? (
                          <img
                            src={previewPhoto}
                            alt={t("account.profilePhotoPreview")}
                            className="size-full object-cover"
                            onError={() => setPreviewPhoto("")}
                          />
                        ) : (
                          <UserRound className="size-8" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {selectedPhotoName ||
                            t("account.photoChoose")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("account.photoBrowseHint")}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium">
                        <Upload className="size-4" /> {t("account.browseFiles")}
                      </span>
                      <input
                        id="profile_photo_file"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file?.type.startsWith("image/")) {
                            setPreviewPhoto(URL.createObjectURL(file))
                            setSelectedPhotoName(file.name)
                          }
                        }}
                      />
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("account.photoPreviewNote")}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {profileFields.slice(0, 4).map((field) => (
                        <div key={field.key}>
                          <Label
                            htmlFor={field.key}
                            className="mb-1.5 block text-xs font-medium"
                          >
                            {field.label}
                          </Label>
                          <Input
                            id={field.key}
                            type={field.type || "text"}
                            value={form[field.key]}
                            onChange={(event) =>
                              updateField(field.key, event.target.value)
                            }
                            placeholder={field.placeholder ? t(field.placeholder) : undefined}
                            maxLength={255}
                            className="min-h-11 bg-background"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 border-t pt-5">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {profileFields.slice(4).map((field) => (
                          <div key={field.key}>
                            <Label
                              htmlFor={field.key}
                              className="mb-1.5 block text-xs font-medium"
                            >
                              {field.label}
                            </Label>
                            <Input
                              id={field.key}
                              type={field.type || "text"}
                              value={form[field.key]}
                              onChange={(event) =>
                                updateField(field.key, event.target.value)
                              }
                              placeholder={field.placeholder ? t(field.placeholder) : undefined}
                              maxLength={255}
                              className="min-h-11 bg-background"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionHeading
                    title={t("account.sections.contact")}
                    description={t("account.sections.contactDescription")}
                  />
                  <div className="rounded-xl border p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {contactFields
                        .filter((field) => field.key !== "address")
                        .map((field) => (
                          <div key={field.key}>
                            <Label
                              htmlFor={field.key}
                              className="mb-1.5 block text-xs font-medium"
                            >
                              {field.label}
                            </Label>
                            <Input
                              id={field.key}
                              type={field.type || "text"}
                              value={form[field.key]}
                              onChange={(event) =>
                                updateField(field.key, event.target.value)
                              }
                              placeholder={field.placeholder ? t(field.placeholder) : undefined}
                              maxLength={255}
                              className="min-h-11 bg-background"
                            />
                          </div>
                        ))}
                    </div>
                    <div className="mt-5 border-t pt-5">
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold">
                          {t("account.residentialAddress")}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("account.addressPartsHint")}
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          {
                            key: "address_line",
                            label: "account.addressFields.street",
                            placeholder: "account.addressPlaceholders.street",
                          },
                          {
                            key: "purok_sitio",
                            label: "account.addressFields.purok",
                            placeholder: "account.addressPlaceholders.purok",
                          },
                          {
                            key: "barangay",
                            label: "account.addressFields.barangay",
                            placeholder: "account.addressPlaceholders.barangay",
                          },
                          {
                            key: "municipality_city",
                            label: "account.addressFields.city",
                            placeholder: "account.addressPlaceholders.city",
                          },
                          {
                            key: "province",
                            label: "account.addressFields.province",
                            placeholder: "account.addressPlaceholders.province",
                          },
                          {
                            key: "zip_code",
                            label: "account.addressFields.zipCode",
                            placeholder: "account.addressPlaceholders.zipCode",
                          },
                        ].map((field) => (
                          <div key={field.key}>
                            <Label
                              htmlFor={field.key}
                              className="mb-1.5 block text-xs font-medium"
                            >
                              {field.label}
                            </Label>
                            <Input
                              id={field.key}
                              value={
                                addressParts[
                                  field.key as keyof typeof addressParts
                                ]
                              }
                              onChange={(event) =>
                                setAddressParts((previous) => ({
                                  ...previous,
                                  [field.key]: event.target.value,
                                }))
                              }
                              placeholder={field.placeholder ? t(field.placeholder) : undefined}
                              maxLength={field.key === "zip_code" ? 10 : 255}
                              className="min-h-11 bg-background"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionHeading
                    title={t("account.sections.security")}
                    description={t("account.sections.securityDescription")}
                  />
                  <div className="rounded-xl border p-4 sm:p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <ShieldCheck className="size-5" />
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold">
                          {t("account.passwordSignIn")}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("account.passwordUpdate")}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/20 p-3">
                      <ChangePassword />
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-xs text-muted-foreground">
              {t("account.footerNote")}
            </p>
            <div className="flex justify-end gap-2">
              {!isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    {t("account.actions.close")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                  >
                    <UserRound className="size-4" />
                    {t("account.actions.edit")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForm(getProfileForm(user))
                      setAddressParts({
                        address_line: user?.address ?? "",
                        purok_sitio: "",
                        barangay: "",
                        municipality_city: "",
                        province: "",
                        zip_code: "",
                      })
                      setPreviewPhoto(user?.profile_photo_url ?? "")
                      setIsEditing(false)
                    }}
                    disabled={mutation.isPending}
                  >
                    {t("account.actions.cancelEdit")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={mutation.isPending}
                  >
                    {t("account.actions.close")}
                  </Button>
                  <Button
                    type="button"
                    onClick={saveProfile}
                    disabled={mutation.isPending}
                    className="gap-2"
                  >
                    <Save className="size-4" />
                    {mutation.isPending ? t("account.actions.saving") : t("account.actions.saveChanges")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
