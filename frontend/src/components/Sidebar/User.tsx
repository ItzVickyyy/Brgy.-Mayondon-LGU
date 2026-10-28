import { useState } from "react"
import { Building2, ChevronsUpDown, FileText, LogOut, Monitor, Moon, Settings, Sun, UserRound, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type Theme, useTheme } from "@/components/theme-provider"
import UserInformation from "@/components/UserSettings/UserInformation"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import useAuth from "@/hooks/useAuth"
import { getInitials } from "@/utils"

function UserInfo({ fullName, email }: { fullName?: string; email?: string }) {
  return <div className="flex w-full min-w-0 items-center gap-2.5"><Avatar className="size-8"><AvatarFallback className="bg-zinc-600 text-white">{getInitials(fullName || "User")}</AvatarFallback></Avatar><div className="flex min-w-0 flex-col items-start"><p className="w-full truncate text-sm font-medium">{fullName}</p><p className="w-full truncate text-xs text-muted-foreground">{email}</p></div></div>
}

function SettingsModal({ open, onOpenChange, isAdmin }: { open: boolean; onOpenChange: (open: boolean) => void; isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState("account")
  const { theme, setTheme } = useTheme()
  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System default", icon: Monitor }]
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Settings</DialogTitle><DialogDescription>Manage your account, personal preferences, and system configuration.</DialogDescription></DialogHeader><Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0"><div className="overflow-x-auto pb-1"><TabsList className="h-auto w-max max-w-full"><TabsTrigger value="account"><UserRound className="size-4" />My Account</TabsTrigger><TabsTrigger value="user"><Users className="size-4" />User Settings</TabsTrigger>{isAdmin ? <TabsTrigger value="system"><Building2 className="size-4" />System Settings</TabsTrigger> : null}</TabsList></div>
<TabsContent value="account" className="mt-4"><div className="grid gap-5 lg:grid-cols-2"><section className="min-w-0 rounded-lg border p-4"><h3 className="mb-3 font-semibold">Account Information</h3><UserInformation /></section><section className="min-w-0 rounded-lg border p-4"><h3 className="mb-3 font-semibold">Change Password</h3><ChangePassword /></section></div></TabsContent>
<TabsContent value="user" className="mt-4"><section className="rounded-lg border p-4"><h3 className="font-semibold">Appearance</h3><p className="mt-1 text-sm text-muted-foreground">Choose how the system interface appears on this workstation.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{themes.map((option) => { const Icon = option.icon; const selected = theme === option.value; return <button key={option.value} type="button" onClick={() => setTheme(option.value)} aria-pressed={selected} className={"flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted " + (selected ? "border-primary bg-primary/5" : "")}><Icon className="size-5" /><span className="flex-1 text-sm font-medium">{option.label}</span>{selected ? <span className="text-xs text-primary">Selected</span> : null}</button> })}</div></section></TabsContent>
{isAdmin ? <TabsContent value="system" className="mt-4"><div className="flex flex-col gap-4"><section className="rounded-lg border p-4"><div className="mb-4 flex items-start gap-3"><Building2 className="mt-0.5 size-5 text-primary" /><div><h3 className="font-semibold">Barangay Information</h3><p className="text-sm text-muted-foreground">Proposed office details for the portal and generated documents.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-medium">Official Barangay Name<input readOnly value="Barangay Mayondon LGU" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label><label className="flex flex-col gap-2 text-sm font-medium">Location<input readOnly value="Los Baños, Laguna" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label><label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Office Address<input readOnly placeholder="To be confirmed with the client" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label></div></section><section className="rounded-lg border p-4"><div className="flex items-start gap-3"><FileText className="mt-0.5 size-5 text-primary" /><div><h3 className="font-semibold">Document Templates</h3><p className="mt-1 text-sm text-muted-foreground">Template editing and persistence are not implemented. Print layouts must be calibrated against actual pre-printed paper and the office printer.</p></div></div></section></div></TabsContent> : null}
</Tabs></DialogContent></Dialog>
}

export function User({ user }: { user: any }) {
  const { logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [settingsOpen, setSettingsOpen] = useState(false)
  if (!user) return null
  const handleMenuClick = () => { if (isMobile) setOpenMobile(false) }
  return <><SidebarMenu><SidebarMenuItem><DropdownMenu><DropdownMenuTrigger asChild><SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" data-testid="user-menu"><UserInfo fullName={user?.full_name} email={user?.email} /><ChevronsUpDown className="ml-auto size-4 text-muted-foreground" /></SidebarMenuButton></DropdownMenuTrigger><DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}><DropdownMenuLabel className="p-0 font-normal"><UserInfo fullName={user?.full_name} email={user?.email} /></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { handleMenuClick(); setSettingsOpen(true) }}><Settings />Settings</DropdownMenuItem><DropdownMenuItem onSelect={async () => { handleMenuClick(); await logout() }}><LogOut />Logout</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarMenuItem></SidebarMenu><SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} isAdmin={Boolean(user?.is_superuser)} /></>
}