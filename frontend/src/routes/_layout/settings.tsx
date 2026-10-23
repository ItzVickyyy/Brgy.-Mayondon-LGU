import { createFileRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Building2, ClipboardList, FileText, Info } from "lucide-react"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/settings")({
  component: SystemSettings,
  head: () => ({ meta: [{ title: pageTitle("System Settings") }] }),
})

function DraftPanel({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Info className="size-5" aria-hidden="true" /></div>
        <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
      <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">Draft section. Final fields and behavior require client approval.</p>
    </section>
  )
}

function SystemSettings() {
  const { user: currentUser } = useAuth()

  if (!currentUser) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin Portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">System Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage system information, document setup, and your administrator account.</p>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
        Settings marked as draft are visual placeholders only. Account profile and password panels use the existing account functionality.
      </div>
      <Tabs defaultValue="barangay">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max">
            <TabsTrigger value="barangay"><Building2 className="mr-2 size-4" />Barangay Information</TabsTrigger>
            <TabsTrigger value="templates"><FileText className="mr-2 size-4" />Document Templates</TabsTrigger>
            <TabsTrigger value="profile">Account Profile</TabsTrigger>
            <TabsTrigger value="password">Change Password</TabsTrigger>
            <TabsTrigger value="audit"><ClipboardList className="mr-2 size-4" />Audit Logs</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="barangay">
          <DraftPanel title="Barangay Information" description="Proposed office information used in the portal and generated documents.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Official Barangay Name<input readOnly value="Barangay Mayondon LGU" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label>
              <label className="flex flex-col gap-2 text-sm font-medium">Location<input readOnly value="Los Baños, Laguna" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label>
              <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Office Address<input readOnly placeholder="To be confirmed with the client" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label>
            </div>
          </DraftPanel>
        </TabsContent>
        <TabsContent value="templates">
          <DraftPanel title="Document Templates" description="A proposed place to manage approved document layouts and required fields.">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <FileText className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No templates configured</p>
              <p className="mt-1 text-sm text-muted-foreground">Add this functionality only after the barangay provides approved sample forms and document requirements.</p>
            </div>
          </DraftPanel>
        </TabsContent>
        <TabsContent value="profile"><div className="rounded-xl border bg-card p-4 sm:p-6"><UserInformation /></div></TabsContent>
        <TabsContent value="password"><div className="rounded-xl border bg-card p-4 sm:p-6"><ChangePassword /></div></TabsContent>
        <TabsContent value="audit">
          <DraftPanel title="Audit Logs" description="A proposed review screen for security-relevant administrative actions.">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <ClipboardList className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">Audit log table not connected</p>
              <p className="mt-1 text-sm text-muted-foreground">The current foundation writes admin actions to application logs. A searchable audit history would require an approved backend design.</p>
            </div>
          </DraftPanel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
