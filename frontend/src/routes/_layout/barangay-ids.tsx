import { createFileRoute, redirect } from "@tanstack/react-router"

// Barangay IDs now live inside Records Management. This route keeps old links working.
export const Route = createFileRoute("/_layout/barangay-ids")({
  beforeLoad: () => {
    throw redirect({ to: "/records", search: { view: "barangay-ids" } })
  },
})
