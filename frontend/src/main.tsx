import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { AxiosError } from "axios"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { client } from "./client/client.gen"
import { PageSkeleton } from "./components/Common/PageSkeleton"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import "./index.css"
import "./i18n"
import { routeTree } from "./routeTree.gen"

client.setConfig({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  auth: () => localStorage.getItem("access_token") || "",
})

const handleApiError = (error: Error) => {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { detail?: { code?: string } }
      | undefined
    if (responseData?.detail?.code === "password_change_required") return
  }

  if (
    error instanceof AxiosError &&
    [401, 403].includes(error.response?.status ?? 0)
  ) {
    localStorage.removeItem("access_token")
    window.location.href = "/login"
  }
}
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})

// Skeleton (not a spinner) while a page is being prepared. The short delay
// keeps it from flashing on fast loads; once shown it stays a moment.
const router = createRouter({
  routeTree,
  defaultPendingComponent: PageSkeleton,
  defaultPendingMs: 150,
  defaultPendingMinMs: 250,
})
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
