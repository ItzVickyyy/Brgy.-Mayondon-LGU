import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Building2, FileText } from "lucide-react"

import { UsersService } from "@/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/settings")({
  component: SystemSettings,
  beforeLoad: async () => {
    const { data: user } = await UsersService.readUserMe()
    if (!user.is_superuser) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({ meta: [{ title: pageTitle("System Settings") }] }),
})

function SettingsPanel({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  )
}

function SystemSettings() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Administration</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">System Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Draft area for system-wide information and document configuration. Settings persistence is not yet implemented.</p>
      </div>
      <Tabs defaultValue="barangay">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max">
            <TabsTrigger value="barangay"><Building2 className="mr-2 size-4" />Barangay Information</TabsTrigger>
            <TabsTrigger value="templates"><FileText className="mr-2 size-4" />Document Templates</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="barangay">
          <SettingsPanel title="Barangay Information" description="Proposed office information used in the portal and generated documents. Confirm these details with the client before enabling editing.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Official Barangay Name<input readOnly value="Barangay Mayondon LGU" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label>
              <label className="flex flex-col gap-2 text-sm font-medium">Location<input readOnly value="Los Baños, Laguna" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label>
              <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Office Address<input readOnly placeholder="To be confirmed with the client" className="h-10 rounded-md border bg-muted/30 px-3 font-normal" /></label>
            </div>
          </SettingsPanel>
        </TabsContent>
        <TabsContent value="templates">
          <SettingsPanel title="Document Templates" description="Future area for managing client-approved document layouts and required fields.">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <FileText className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">Template configuration is a draft</p>
              <p className="mt-1 text-sm text-muted-foreground">Template editing and persistence are not implemented yet. Print alignment must be validated using the actual pre-printed paper and office printer.</p>
            </div>
          </SettingsPanel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
