import {
  Check,
  CircleHelp,
  Info,
  Languages,
  LogOut,
  UserRound,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HelpDialog, LearnMoreDialog } from "@/components/Common/InfoDialogs"
import { MyAccountModal } from "@/components/Settings/MyAccountModal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSidebar } from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { LANGUAGES, type Language, setLanguage } from "@/i18n"

export function User({
  user,
  compact = false,
}: {
  user: any
  compact?: boolean
}) {
  const { logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [accountOpen, setAccountOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const selectedLanguage: Language =
    i18n.resolvedLanguage === "fil" ? "fil" : "en"
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [learnOpen, setLearnOpen] = useState(false)

  if (!user) return null

  const handleMenuClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <div
        className={
          compact
            ? "w-auto min-w-0"
            : "w-full px-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:px-0"
        }
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={
                compact
                  ? "min-h-11 w-auto max-w-[280px] min-w-0 justify-start gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-muted/70 sm:px-2"
                  : "h-auto w-full min-w-0 justify-start gap-2 rounded-lg px-2 py-2 text-left group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0"
              }
              aria-label={t("userMenu.ariaLabel")}
              title={user?.full_name || user?.email || t("userMenu.ariaLabel")}
            >
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/20 bg-brand/10 text-brand">
                {user?.profile_photo_url ? (
                  <img
                    src={user.profile_photo_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <UserRound className="size-4" />
                )}
              </span>
              <span
                className={
                  compact
                    ? "hidden min-w-0 flex-1 sm:block"
                    : "min-w-0 flex-1 group-data-[collapsible=icon]:hidden"
                }
              >
                <span className="block truncate text-sm font-medium">
                  {user?.full_name || user?.email || t("userMenu.fallbackName")}
                </span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {user?.email || ""}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56"
            side={compact ? "bottom" : "top"}
            align={compact ? "end" : "start"}
            sideOffset={8}
          >
            {compact ? (
              <>
                <DropdownMenuLabel className="sm:hidden">
                  <span className="block truncate text-sm font-medium">
                    {user?.full_name ||
                      user?.email ||
                      t("userMenu.fallbackName")}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {user?.email || ""}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="sm:hidden" />
              </>
            ) : null}
            <DropdownMenuItem onSelect={() => setAccountOpen(true)}>
              <UserRound className="size-4" />
              {t("userMenu.myAccount")}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 data-[state=open]:text-foreground">
                <Languages className="size-4 text-muted-foreground" />
                {t("language.label")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {LANGUAGES.map((language) => {
                  const selected = selectedLanguage === language
                  return (
                    <DropdownMenuItem
                      key={language}
                      lang={language}
                      onSelect={() => setLanguage(language)}
                      className="gap-2 px-3 py-2"
                    >
                      <span className="flex-1">
                        {t(
                          language === "en"
                            ? "language.english"
                            : "language.filipino",
                        )}
                      </span>
                      {selected ? (
                        <Check className="size-4 text-brand" />
                      ) : null}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                handleMenuClick()
                setHelpOpen(true)
              }}
            >
              <CircleHelp className="size-4" />
              {t("userMenu.getHelp")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                handleMenuClick()
                setLearnOpen(true)
              }}
            >
              <Info className="size-4" />
              {t("userMenu.learnMore")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                handleMenuClick()
                setLogoutOpen(true)
              }}
            >
              <LogOut className="size-4" />
              {t("userMenu.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <MyAccountModal
        open={accountOpen}
        onOpenChange={setAccountOpen}
        user={user}
      />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <LearnMoreDialog open={learnOpen} onOpenChange={setLearnOpen} />
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("logoutDialog.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("logoutDialog.message")}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogoutOpen(false)}
            >
              {t("logoutDialog.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setLogoutOpen(false)
                void logout()
              }}
            >
              {t("logoutDialog.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
