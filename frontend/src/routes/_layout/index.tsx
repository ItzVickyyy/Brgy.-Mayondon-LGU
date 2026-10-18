import { createFileRoute } from "@tanstack/react-router"
import { pageTitle, SITE } from "@/config/site"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: pageTitle("Dashboard"),
      },
    ],
  }),
})

function Dashboard() {
  const { user: currentUser } = useAuth()

  return (
    <div>
      <div>
        <h1 className="text-2xl truncate max-w-sm">
          Hi, {currentUser?.full_name || currentUser?.email} 👋
        </h1>
        <p className="text-muted-foreground">
          Welcome back, nice to see you again!
        </p>
        <p className="text-muted-foreground text-sm mt-1">{SITE.systemName}</p>
      </div>
    </div>
  )
}
