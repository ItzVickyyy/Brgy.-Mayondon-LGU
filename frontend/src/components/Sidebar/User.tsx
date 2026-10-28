import { useState } from "react"
import {
  Building2,
  ChevronsUpDown,
  FileText,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
  SlidersHorizontal,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { type Theme, useTheme } from "@/components/theme-provider"
import UserInformation from "@/components/UserSettings/UserInformation"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import useAuth from "@/hooks/useAuth"
import { getInitials } from "@/utils"

type SettingsSection = "account" | "preferences" | "office"

function UserInfo({ fullName, email }: { fullName?: string; email?: string }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2.5">
      <Avatar className="size-8">
        <AvatarFallback className="bg-zinc-600 text-white">
          {getInitials(fullName || "User")}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col items-start">
        <p className="w-full truncate text-sm font-medium">{fullName}</p>
        <p className="w-full truncate text-xs text-muted-foreground">{email}</p>
      </div>
    </div>
  )
}

function SettingsModal({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
}) {
  const [section, setSection] = useState<SettingsSection>("account")
  const { theme, setTheme } = useTheme()

  const sections = [
    { value: "account" as const, label: "My Account", icon: UserRound },
    { value: "preferences" as const, label: "Preferences", icon: SlidersHorizontal },
    ...(isAdmin
      ? [{ value: "office" as const, label: "Office Setup", icon: Building2 }]
      : []),
  ]

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System default", icon: Monitor },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] min-h-[420px] max-h-[760px] flex-col gap-0 overflow-hidden p-0 sm:min-h-[560px] sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your account, preferences, and office configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-[190px_minmax(0,1fr)]">
          <nav
            aria-label="Settings sections"
            className="flex shrink-0 gap-2 overflow-x-auto border-b p-3 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-4"
          >
            {sections.map((item) => {
              const Icon = item.icon
              const active = section === item.value
              return (
                <Button
                  key={item.value}
                  type="button"
                  variant={active ? "secondary" : "ghost"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSection(item.value)}
                  className="shrink-0 justify-start gap-2 sm:w-full"
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Button>
              )
            })}
          </nav>

          <div className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
            {section === "account" ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold">My Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your profile information and account security.
                  </p>
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="min-w-0 rounded-lg border p-4">
                    <h4 className="mb-3 font-semibold">Account Information</h4>
                    <UserInformation />
                  </section>
                  <section className="min-w-0 rounded-lg border p-4">
                    <h4 className="mb-3 font-semibold">Change Password</h4>
                    <ChangePassword />
                  </section>
                </div>
              </div>
            ) : null}

            {section === "preferences" ? (
              <section className="rounded-lg border p-4">
                <div>
                  <h3 className="font-semibold">Appearance</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose how the system interface appears on this workstation.
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {themes.map((option) => {
                    const Icon = option.icon
                    const selected = theme === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTheme(option.value)}
                        aria-pressed={selected}
                        className={
                          "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted " +
                          (selected ? "border-primary bg-primary/5" : "")
                        }
                      >
                        <Icon className="size-5" />
                        <span className="flex-1 text-sm font-medium">{option.label}</span>
                        {selected ? (
                          <span className="text-xs text-primary">Selected</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {section === "office" && isAdmin ? (
              <div className="flex flex-col gap-4">
                <section className="rounded-lg border p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <Building2 className="mt-0.5 size-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">Barangay Information</h3>
                      <p className="text-sm text-muted-foreground">
                        Office details used throughout the system.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Official Barangay Name
                      <input readOnly value="Barangay Mayondon LGU" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Location
                      <input readOnly value="Los Baños, Laguna" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
                      Office Address
                      <input readOnly placeholder="Office address" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" />
                    </label>
                  </div>
                </section>
                <section className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 size-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">Document Templates</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Manage the document templates used for barangay clearances, certificates, and IDs.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function User({ user }: { user: any }) {
  const { logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!user) return null

  const handleMenuClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" data-testid="user-menu">
                <UserInfo fullName={user?.full_name} email={user?.email} />
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
              <DropdownMenuLabel className="p-0 font-normal">
                <UserInfo fullName={user?.full_name} email={user?.email} />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { handleMenuClick(); setSettingsOpen(true) }}>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={async () => { handleMenuClick(); await logout() }}>
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} isAdmin={Boolean(user?.is_superuser)} />
    </>
  )
}
