// Note: the `PrivateService` is only available when generating the client
// for local environments
import { PrivateService } from "../../src/client"
import { client } from "../../src/client/client.gen"

// Playwright runs in Node, so it does not inherit Vite's client-side env injection.
// Use the explicit API URL when provided, otherwise target the local backend port.
const apiBaseURL =
  process.env.VITE_API_URL ||
  process.env.API_BASE_URL ||
  "http://127.0.0.1:8000"

client.setConfig({
  baseURL: apiBaseURL,
})

export const createUser = async ({
  email,
  password,
}: {
  email: string
  password: string
}) => {
  const response = await PrivateService.createUser({
    body: {
      email,
      password,
      is_verified: true,
      full_name: "Test User",
    },
  })
  return response.data
}
