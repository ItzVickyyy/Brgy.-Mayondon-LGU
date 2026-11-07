import { createFileRoute, redirect } from "@tanstack/react-router"

// The public landing page was removed (D-27). Old links and bookmarks go to staff login.
export const Route = createFileRoute("/welcome")({
  beforeLoad: () => {
    throw redirect({ to: "/login" })
  },
})
