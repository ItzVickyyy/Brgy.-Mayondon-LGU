import type { APIRequestContext } from "@playwright/test"

type EmailSummary = {
  ID: string
}

const mailpitHost = (
  process.env.MAILPIT_HOST || "http://127.0.0.1:8025"
).replace(/\/$/, "")

export async function waitForEmailHtml({
  request,
  query,
  timeout = 10000,
}: {
  request: APIRequestContext
  query: string
  timeout?: number
}) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const response = await request.get(`${mailpitHost}/api/v1/search`, {
      params: { query, limit: 1 },
    })

    if (!response.ok()) {
      throw new Error(
        `Mailpit search failed at ${mailpitHost}/api/v1/search: HTTP ${response.status()}`,
      )
    }

    const contentType = response.headers()["content-type"] || ""
    if (!contentType.includes("application/json")) {
      const preview = (await response.text())
        .slice(0, 120)
        .replace(/\\s+/g, " ")
      throw new Error(
        `Mailpit returned non-JSON content from ${mailpitHost}/api/v1/search (content-type: ${contentType || "unknown"}). Check MAILPIT_HOST and ensure Mailpit is running. Response: ${preview}`,
      )
    }

    const { messages }: { messages: EmailSummary[] } = await response.json()
    const email = messages[0]

    if (email) {
      const htmlResponse = await request.get(
        `${mailpitHost}/view/${email.ID}.html`,
      )
      if (!htmlResponse.ok()) {
        throw new Error(
          `Could not get the HTML for email "${email.ID}": ${htmlResponse.status()}`,
        )
      }
      return htmlResponse.text()
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(
    `Timeout while trying to get the latest email for "${query}" from Mailpit at ${mailpitHost}`,
  )
}
