import { useState } from "react"
import {
  CircleHelp,
  Info,
  Languages,
  Check,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react"

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
import { useSidebar } from "@/components/ui/sidebar"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import useAuth from "@/hooks/useAuth"

function displayValue(value: unknown) {
  return value === null || value === undefined || value === "" ? "Not provided" : String(value)
}

function AccountField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{displayValue(value)}</p>
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
  const profilePhoto = user?.profile_photo_url || user?.profile_photo || user?.avatar_url
  const role = user?.role || (user?.is_superuser ? "Administrator" : "Staff")
  const status = user?.is_active === undefined ? "Active" : user.is_active ? "Active" : "Inactive"
  const twoFactorEnabled = user?.two_factor_enabled ?? user?.mfa_enabled

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-base font-semibold">My Account</DialogTitle>
          <p className="text-sm text-muted-foreground">View your account details and security settings.</p>
        </DialogHeader>

        <div className="min-h-0 space-y-6 overflow-y-auto p-5 sm:p-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Account Information</h3>
            <div className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
              <AccountField label="Status" value={status} />
              <AccountField label="Username" value={user?.username} />
              <AccountField label="Email" value={user?.email} />
              <AccountField label="Role" value={role} />
              <AccountField label="Governing LGU" value={user?.governing_lgu_name || user?.governing_lgu} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Personal Information</h3>
            <div className="rounded-lg border p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Profile Photo</p>
              <div className="flex items-center gap-3">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="size-14 rounded-full border object-cover" />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                    <UserRound className="size-6" />
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{profilePhoto ? "Current profile photo" : "No profile photo uploaded"}</span>
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
              <AccountField label="First Name" value={user?.first_name} />
              <AccountField label="Middle Name" value={user?.middle_name} />
              <AccountField label="Last Name" value={user?.last_name} />
              <AccountField label="Extension Name" value={user?.extension_name} />
              <AccountField label="Sex" value={user?.sex} />
              <AccountField label="Civil Status" value={user?.civil_status} />
              <AccountField label="Birthdate" value={user?.birthdate} />
              <AccountField label="Birthplace" value={user?.birthplace} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Contact Information</h3>
            <div className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
              <AccountField label="Email" value={user?.email} />
              <AccountField label="Phone Number" value={user?.phone_number || user?.phone} />
              <AccountField label="Address" value={user?.address} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Security</h3>
            <div className="space-y-5 rounded-lg border p-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Change Password</h4>
                <ChangePassword />
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium">Two-Factor Authentication (2FA)</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {twoFactorEnabled === true
                    ? "Two-factor authentication is enabled for this account."
                    : twoFactorEnabled === false
                      ? "Two-factor authentication is disabled for this account."
                      : "Two-factor authentication status is not available."}
                </p>
              </div>
            </div>
          </section>
        </div>
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
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-primary transition-colors group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:border-border group-data-[collapsible=icon]:bg-muted group-data-[collapsible=icon]:text-muted-foreground">
                {user?.profile_photo_url || user?.profile_photo || user?.avatar_url ? (
                  <img src={user.profile_photo_url || user.profile_photo || user.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  <UserRound className="size-4" />
                )}
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
                    <DropdownMenuItem
                      key={language}
                      onSelect={() => setSelectedLanguage(language)}
                      className="gap-2 px-3 py-2"
                    >
                      <span className="flex-1">{language}</span>
                      {selected ? <Check className="size-4 text-primary" /> : null}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { handleMenuClick(); window.open("https://www.dilg.gov.ph/", "_blank", "noopener,noreferrer") }}>
              <CircleHelp className="size-4" />
              Get help
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { handleMenuClick(); window.open("https://www.dilg.gov.ph/", "_blank", "noopener,noreferrer") }}>
              <Info className="size-4" />
              Learn more
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { handleMenuClick(); setLogoutOpen(true) }}>
              <LogOut className="size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <MyAccountModal open={accountOpen} onOpenChange={setAccountOpen} user={user} />
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
          </DialogHeader>
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
