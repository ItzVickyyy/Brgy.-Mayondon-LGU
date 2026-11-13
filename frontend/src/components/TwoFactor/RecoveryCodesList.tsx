import { Copy, Download } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"

type Props = { codes: string[] }

/** The ten one-time codes, shown once. Copy or save them before closing. */
export function RecoveryCodesList({ codes }: Props) {
  const { t } = useTranslation()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const text = codes.join("\n")

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showSuccessToast(t("twoFactor.codes.copied"), { keep: false })
    } catch {
      showErrorToast(t("twoFactor.codes.copyFailed"))
    }
  }

  const download = () => {
    const blob = new Blob(
      [`${t("twoFactor.codes.fileHeading")}\n\n${text}\n`],
      {
        type: "text/plain",
      },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "recovery-codes.txt"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-3">
      <ul
        className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm"
        data-testid="mfa-recovery-codes"
      >
        {codes.map((code) => (
          <li key={code} className="tracking-wider">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-9"
          onClick={copy}
        >
          <Copy className="size-4" />
          {t("twoFactor.codes.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-9"
          onClick={download}
        >
          <Download className="size-4" />
          {t("twoFactor.codes.download")}
        </Button>
      </div>
    </div>
  )
}
