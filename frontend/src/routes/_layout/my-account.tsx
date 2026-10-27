import { createFileRoute } from "@tanstack/react-router"
import { UserRound, KeyRound } from "lucide-react"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/my-account")({
  component: MyAccount,
  head: () => ({ meta: [{ title: pageTitle("My Account") }] }),
})

function MyAccount() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Personal settings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">My Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">View your account information and update your password.</p>
      </div>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile"><UserRound className="mr-2 size-4" />Account Profile</TabsTrigger>
          <TabsTrigger value="password"><KeyRound className="mr-2 size-4" />Change Password</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <section className="rounded-xl border bg-card p-4 sm:p-6"><UserInformation /></section>
        </TabsContent>
        <TabsContent value="password">
          <section className="rounded-xl border bg-card p-4 sm:p-6"><ChangePassword /></section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
