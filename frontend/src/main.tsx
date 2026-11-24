import { QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { client } from "./client/client.gen"
import { PageSkeleton } from "./components/Common/PageSkeleton"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import "./index.css"
import "./i18n"
import { applyRememberedAppearance } from "./lib/preferences"
import { queryClient } from "./lib/queryClient"
import { routeTree } from "./routeTree.gen"

// Accent colour and font size of the last signed-in user, before the first paint.
applyRememberedAppearance()

client.setConfig({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  auth: () => localStorage.getItem("access_token") || "",
})

// Skeleton (not a spinner) while a page is being prepared. The short delay
// keeps it from flashing on fast loads; once shown it stays a moment.
const router = createRouter({
  routeTree,
  defaultPendingComponent: PageSkeleton,
  defaultPendingMs: 150,
  defaultPendingMinMs: 120,
  // A link's page code and data start loading when the pointer or focus reaches it.
  defaultPreload: "intent",
})
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
          closeButton
          visibleToasts={4}
          duration={5000}
          gap={10}
          position="top-right"
          offset={{ top: 72, right: 16 }}
          mobileOffset={{ top: 72, right: 16, left: 16 }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
