import { Link as RouterLink } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

export function NoPermission() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="rounded-full bg-muted p-4">
        <ShieldAlert
          className="size-8 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight"{t("common.permission.title")}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("common.permission.description")}
        </p>
      </div>
      <Button asChild className="min-h-11">
        <RouterLink to="/"{t("common.permission.back")}</RouterLink>
      </Button>
    </main>
  )
}
