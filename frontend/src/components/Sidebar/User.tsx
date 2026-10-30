import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CircleHelp,
  Info,
  Languages,
  Check,
  LogOut,
  Settings,
  UserRound,
  Save,
  Upload,
  ShieldCheck,
} from "lucide-react"

import { UsersService, type UserUpdateMe } from "@/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSidebar } from "@/components/ui/sidebar"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import useAuth from "@/hooks/useAuth"
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

const profileFields: { key: keyof ProfileForm; label: string; type?: string; placeholder?: string }[] = [
  { key: "first_name", label: "First Name", placeholder: "Enter first name" },
  { key: "middle_name", label: "Middle Name", placeholder: "Enter middle name or initial" },
  { key: "last_name", label: "Last Name", placeholder: "Enter last name" },
  { key: "extension_name", label: "Extension Name", placeholder: "Jr., Sr., III, etc." },
  { key: "sex", label: "Sex", placeholder: "Enter sex" },
  { key: "civil_status", label: "Civil Status", placeholder: "Enter civil status" },
  { key: "birthdate", label: "Birthdate", type: "date" },
  { key: "birthplace", label: "Birthplace", placeholder: "City or municipality" },
]

const contactFields: { key: keyof ProfileForm; label: string; type?: string; placeholder?: string }[] = [
  { key: "email", label: "Email", type: "email", placeholder: "name@example.com" },
  { key: "phone_number", label: "Phone Number", type: "tel", placeholder: "09XX XXX XXXX" },
  { key: "address", label: "Address", placeholder: "House no., street, barangay, city" },
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
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium leading-5">{value || "Not provided"}</p>
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function MyAccountModal({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [form, setForm] = useState<ProfileForm>(() => getProfileForm(user))
  const [previewPhoto, setPreviewPhoto] = useState(user?.profile_photo_url ?? "")
  const [selectedPhotoName, setSelectedPhotoName] = useState("")
  const [isPhotoDragging, setIsPhotoDragging] = useState(false)

  useEffect(() => {
    const next = getProfileForm(user)
    setForm(next)
    setPreviewPhoto(next.profile_photo_url)
    setSelectedPhotoName("")
  }, [user, open])

  const updateField = (key: keyof ProfileForm, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    if (key === "profile_photo_url") setPreviewPhoto(value)
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) => UsersService.updateUserMe({ body: data }),
    onSuccess: () => {
      showSuccessToast("My Account updated successfully")
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      queryClient.invalidateQueries()
    },
    onError: handleError.bind(showErrorToast),
  })

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fullName = [form.first_name, form.middle_name, form.last_name, form.extension_name]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ")
    const payload = {
      ...form,
      full_name: fullName || user?.full_name || "",
    }
    mutation.mutate(payload as unknown as UserUpdateMe)
  }

  const status = user?.is_active === false ? "Inactive" : "Active"
  const role = user?.is_superuser ? "Administrator" : "Staff"
  const username = user?.username || user?.email || "Not provided"

  const renderFields = (fields: typeof profileFields) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className={field.key === "address" ? "sm:col-span-2" : ""}>
          <Label htmlFor={field.key} className="mb-1.5 block text-xs font-medium">{field.label}</Label>
          <Input
            id={field.key}
            type={field.type || "text"}
            value={form[field.key]}
            onChange={(event) => updateField(field.key, event.target.value)}
            placeholder={field.placeholder}
            maxLength={field.key === "address" ? 500 : 255}
            className="h-10 bg-background"
          />
        </div>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b bg-muted/20 px-5 py-4 text-left sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">My Account</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">Manage your personal details, contact information, and security.</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={saveProfile} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5 sm:p-7">
            <section>
              <SectionHeading title="Account Information" description="Your account status and assigned access level." />
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border bg-muted/20 px-4 py-3.5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-2 xl:grid-cols-[0.8fr_1.25fr_1fr_1.7fr]">
                <AccountField label="Status" value={status} />
                <AccountField label="Username" value={username} />
                <AccountField label="Role" value={role} />
                <AccountField label="Governing LGU" value="Brgy. Mayondon Los Baños, Laguna" />
              </div>
            </section>

            <section>
              <SectionHeading title="Personal Information" description="Keep your personal details accurate and up to date." />
              <div className="mb-4 rounded-xl border bg-muted/10 p-4 sm:p-5">
                <Label htmlFor="profile_photo_file" className="mb-2 block text-xs font-medium">Profile Photo</Label>
                <label
                  htmlFor="profile_photo_file"
                  onDragOver={(event) => { event.preventDefault(); setIsPhotoDragging(true) }}
                  onDragLeave={() => setIsPhotoDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setIsPhotoDragging(false)
                    const file = event.dataTransfer.files?.[0]
                    if (file && file.type.startsWith("image/")) {
                      setPreviewPhoto(URL.createObjectURL(file))
                      setSelectedPhotoName(file.name)
                    }
                  }}
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors sm:flex-row sm:text-left ${isPhotoDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}`}
                >
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background text-muted-foreground shadow-sm">
                    {previewPhoto ? <img src={previewPhoto} alt="Profile preview" className="size-full object-cover" onError={() => setPreviewPhoto("")} /> : <UserRound className="size-8" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{selectedPhotoName || "Choose a photo or drag it here"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Click to browse files. JPG, PNG, or WEBP images recommended.</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium">
                    <Upload className="size-4" /> Browse files
                  </span>
                  <input
                    id="profile_photo_file"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file && file.type.startsWith("image/")) {
                        setPreviewPhoto(URL.createObjectURL(file))
                        setSelectedPhotoName(file.name)
                      }
                    }}
                  />
                </label>
                <p className="mt-2 text-xs text-muted-foreground">Photo selection and preview are available in this form. Uploading and saving the image to your account will be connected later.</p>
              </div>
              <div className="rounded-xl border p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {profileFields.slice(0, 4).map((field) => (
                    <div key={field.key}>
                      <Label htmlFor={field.key} className="mb-1.5 block text-xs font-medium">{field.label}</Label>
                      <Input id={field.key} type={field.type || "text"} value={form[field.key]} onChange={(event) => updateField(field.key, event.target.value)} placeholder={field.placeholder} maxLength={255} className="h-10 bg-background" />
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t pt-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {profileFields.slice(4).map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={field.key} className="mb-1.5 block text-xs font-medium">{field.label}</Label>
                        <Input id={field.key} type={field.type || "text"} value={form[field.key]} onChange={(event) => updateField(field.key, event.target.value)} placeholder={field.placeholder} maxLength={255} className="h-10 bg-background" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionHeading title="Contact Information" description="These details help the office reach you when needed." />
              <div className="rounded-xl border p-4">
                {renderFields(contactFields)}
              </div>
            </section>

            <section>
              <SectionHeading title="Security" description="Protect your account and sign-in credentials." />
              <div className="rounded-xl border p-4 sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
                  <div>
                    <h4 className="text-sm font-semibold">Password & Sign-in</h4>
                    <p className="mt-1 text-xs text-muted-foreground">Update your password to help keep your account secure.</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/20 p-3">
                  <ChangePassword />
                </div>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-xs text-muted-foreground">Account status and role can only be changed by an administrator.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Close</Button>
              <Button type="submit" disabled={mutation.isPending} className="gap-2">
                <Save className="size-4" />
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function User({ user, compact = false }: { user: any; compact?: boolean }) {
  const { logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [accountOpen, setAccountOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<"English" | "Filipino">("English")
  const [logoutOpen, setLogoutOpen] = useState(false)

  if (!user) return null

  const handleMenuClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <div className={compact ? "w-auto min-w-0" : "w-full px-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:px-0"}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={compact ? "h-10 w-auto max-w-[280px] min-w-0 justify-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/70" : "h-auto w-full min-w-0 justify-start gap-2 rounded-lg px-2 py-2 text-left group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0"}
              aria-label="User menu"
              title={user?.full_name || user?.email || "User menu"}
            >
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-primary">
                {user?.profile_photo_url ? <img src={user.profile_photo_url} alt="" className="size-full object-cover" /> : <UserRound className="size-4" />}
              </span>
              <span className={compact ? "min-w-0 flex-1" : "min-w-0 flex-1 group-data-[collapsible=icon]:hidden"}>
                <span className="block truncate text-sm font-medium">{user?.full_name || user?.email || "User"}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{user?.email || ""}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" side={compact ? "bottom" : "top"} align={compact ? "end" : "start"} sideOffset={8}>
            <DropdownMenuItem onSelect={() => setAccountOpen(true)}>
              <Settings className="size-4" />
              My Account
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 data-[state=open]:text-foreground">
                <Languages className="size-4 text-muted-foreground" />
                Language
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {(["English", "Filipino"] as const).map((language) => {
                  const selected = selectedLanguage === language
                  return (
                    <DropdownMenuItem key={language} onSelect={() => setSelectedLanguage(language)} className="gap-2 px-3 py-2">
                      <span className="flex-1">{language}</span>
                      {selected ? <Check className="size-4 text-primary" /> : null}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { handleMenuClick(); window.open("https://www.dilg.gov.ph/", "_blank", "noopener,noreferrer") }}>
              <CircleHelp className="size-4" />Get help
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { handleMenuClick(); window.open("https://www.dilg.gov.ph/", "_blank", "noopener,noreferrer") }}>
              <Info className="size-4" />Learn more
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { handleMenuClick(); setLogoutOpen(true) }}>
              <LogOut className="size-4" />Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <MyAccountModal open={accountOpen} onOpenChange={setAccountOpen} user={user} />
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log out?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to log out of your account?</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => { setLogoutOpen(false); void logout() }}>Log out</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
