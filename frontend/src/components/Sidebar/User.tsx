import { useMemo, useState } from "react"
import {
  CircleHelp,
  Info,
  LogOut,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { type Theme, useTheme } from "@/components/theme-provider"
import UserInformation from "@/components/UserSettings/UserInformation"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import useAuth from "@/hooks/useAuth"

type SettingsSection = "account" | "preferences"

function SettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [section, setSection] = useState<SettingsSection>("preferences")
  const [search, setSearch] = useState("")
  const { theme, setTheme } = useTheme()

  const sections = [
    { value: "account" as const, label: "My Account", icon: UserRound },
    { value: "preferences" as const, label: "Preferences", icon: Settings },
  ]

  const filteredSections = useMemo(
    () => sections.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase())),
    [search],
  )

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "system", label: "System default", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ]

  const selectSection = (value: SettingsSection) => {
    setSection(value)
    setSearch("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[82vh] min-h-[500px] max-h-[720px] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="flex h-12 shrink-0 flex-row items-center border-b px-4 py-0 text-left">
          <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-[210px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b p-3 sm:border-b-0 sm:border-r sm:p-4">
            <div className="relative mb-3 shrink-0">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search settings"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search settings"
                className="h-9 w-full rounded-md border bg-muted/40 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>

            <nav
              aria-label="Settings sections"
              className="flex min-h-0 gap-1 overflow-x-auto sm:flex-1 sm:flex-col sm:overflow-y-auto"
            >
              {filteredSections.map((item, index) => {
                const Icon = item.icon
                const active = section === item.value
                const previous = filteredSections[index - 1]
                const showDivider = item.value === "preferences" && previous?.value === "account"

                return (
                  <div key={item.value} className="shrink-0">
                    {showDivider ? <div className="my-2 hidden border-t sm:block" /> : null}
                    <Button
                      type="button"
                      variant="ghost"
                      aria-current={active ? "page" : undefined}
                      onClick={() => selectSection(item.value)}
                      className={
                        "h-9 justify-start gap-2 rounded-md px-2.5 text-sm sm:w-full " +
                        (active ? "bg-accent font-medium text-accent-foreground hover:bg-accent" : "font-normal")
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Button>
                  </div>
                )
              })}
              {filteredSections.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">No settings found.</p>
              ) : null}
            </nav>
          </aside>

          <main className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
            {section === "account" ? (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold">My Account</h3>
                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="min-w-0 rounded-lg border p-4">
                    <h4 className="mb-3 text-sm font-medium">Account Information</h4>
                    <UserInformation />
                  </section>
                  <section className="min-w-0 rounded-lg border p-4">
                    <h4 className="mb-3 text-sm font-medium">Change Password</h4>
                    <ChangePassword />
                  </section>
                </div>
              </div>
            ) : null}

            {section === "preferences" ? (
              <div className="space-y-1">
                <h3 className="mb-4 text-sm font-semibold">General</h3>
                <div className="flex min-h-16 flex-col justify-center gap-3 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-muted-foreground sm:hidden">Choose the interface appearance.</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border p-1">
                    {themes.map((option) => {
                      const Icon = option.icon
                      const selected = theme === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTheme(option.value)}
                          aria-label={option.label}
                          aria-pressed={selected}
                          title={option.label}
                          className={
                            "flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors " +
                            (selected ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")
                          }
                        >
                          <Icon className="size-4" />
                          <span>{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function User({ user }: { user: any }) {
  const { logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  if (!user) return null

  const handleMenuClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <div className="w-full px-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:px-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto w-full min-w-0 justify-start gap-2 rounded-lg px-2 py-2 text-left group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0"
                aria-label="User menu"
                title={user?.full_name || user?.email || "User menu"}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary transition-colors group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:border-border group-data-[collapsible=icon]:bg-muted group-data-[collapsible=icon]:text-muted-foreground">
                  <UserRound className="size-4" />
                </span>
                <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-sm font-medium">{user?.full_name || user?.email || "User"}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">{user?.email || ""}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" side="top" align="start" sideOffset={8}>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
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
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
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
