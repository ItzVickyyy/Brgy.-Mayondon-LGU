import { useState } from "react"
import {
  CircleHelp,
  Info,
  Languages,
  Check,
  LogOut,
  UserRound,
  ShieldCheck,
  Settings,
} from "lucide-react"

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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import { MyAccountModal } from "@/components/Settings/MyAccountModal"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"

export function User({ user, compact = false }: { user: any; compact?: boolean }) {
  const { logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [accountOpen, setAccountOpen] = useState(false)
  const [userSettingsOpen, setUserSettingsOpen] = useState(false)
  const [systemSettingsOpen, setSystemSettingsOpen] = useState(false)
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
              className={compact ? "min-h-11 w-auto max-w-[280px] min-w-0 justify-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/70" : "h-auto w-full min-w-0 justify-start gap-2 rounded-lg px-2 py-2 text-left group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0"}
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
              <UserRound className="size-4" />
              My Account
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setUserSettingsOpen(true)}>
              <Settings className="size-4" />
              User Settings
            </DropdownMenuItem>
            {isSystemAdministrator(user) ? (
              <DropdownMenuItem onSelect={() => setSystemSettingsOpen(true)}>
                <ShieldCheck className="size-4" />
                System Settings
              </DropdownMenuItem>
            ) : null}
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
      <Dialog open={userSettingsOpen} onOpenChange={setUserSettingsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>User Settings</DialogTitle>
            <DialogDescription>Manage personal preferences and account security.</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ChangePassword />
          </div>
        </DialogContent>
      </Dialog>
      {isSystemAdministrator(user) ? (
        <Dialog open={systemSettingsOpen} onOpenChange={setSystemSettingsOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>System Settings</DialogTitle>
              <DialogDescription>Draft settings areas for administrator review. These placeholders are not connected to saved system configuration.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Barangay Information", description: "Review the barangay name and office details." },
                { title: "Document Templates", description: "Review approved document layouts and print settings." },
                { title: "Document Purposes", description: "Review the purpose list used in issuance forms." },
                { title: "Access and Audit", description: "Review account access rules and audit-history requirements." },
              ].map((item) => (
                <section key={item.title} className="rounded-lg border p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">Draft, pending barangay review</p>
                </section>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
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
