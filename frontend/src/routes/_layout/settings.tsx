import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import UserInformation from "@/components/UserSettings/UserInformation"
import { pageTitle } from "@/config/site"

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: pageTitle("Settings") }] }),
})

type SettingsTab = "profile" | "password"

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your account information and password.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3" role="tablist" aria-label="Account settings">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          onClick={() => setActiveTab("profile")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Account Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "password"}
          onClick={() => setActiveTab("password")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === "password" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Change Password
        </button>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm" role="tabpanel">
        {activeTab === "profile" ? <UserInformation /> : <ChangePassword />}
      </section>
    </div>
  )
}
