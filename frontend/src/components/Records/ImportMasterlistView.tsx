import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileUp, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  type ImportBatchPublic,
  ImportsService,
  type ImportUploadPublic,
} from "@/client"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { Select } from "@/components/Common/Select"
import { statusStyles } from "@/components/Common/statusStyles"
import { TablePagination } from "@/components/Common/TablePagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { importProblemText } from "@/lib/importProblems"
import { formatLocaleDate, formatLocaleNumber } from "@/lib/locale"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const STEPS = ["select", "map", "preview", "results"] as const
type Step = (typeof STEPS)[number]

const DATE_ORDERS = ["ymd", "mdy", "dmy"] as const
type DateOrder = (typeof DATE_ORDERS)[number]
const DUPLICATE_ACTIONS = ["skip", "update"] as const
type DuplicateAction = (typeof DUPLICATE_ACTIONS)[number]

const ROW_FILTERS = ["all", "new", "duplicate", "error"] as const
type RowFilter = (typeof ROW_FILTERS)[number]


// The fields the API accepts (mirrors IMPORT_FIELDS in the backend). Shown
// labels are translated; the keys are what the API stores and expects.
const FIELD_KEYS = [
  "first_name",
  "middle_name",
  "last_name",
  "suffix",
  "birthdate",
  "birth_place",
  "sex",
  "civil_status",
  "house_number",
  "street",
  "purok",
  "resident_since_year",
  "resident_type",
  "id_number",
  "voter_registration",
  "emergency_contact_name",
  "emergency_contact_address",
  "emergency_contact_phone",
] as const
type FieldKey = (typeof FIELD_KEYS)[number]

function isFieldKey(value: string): value is FieldKey {
  return (FIELD_KEYS as readonly string[]).includes(value)
}

// statusStyles is keyed by an English status word, not by the shown label.
const classificationStyle = {
  new: "Valid",
  duplicate: "Pending",
  error: "Failed",
} as const

const batchStatusStyle = {
  committed: "Completed",
  failed: "Failed",
  cancelled: "Pending",
  expired: "Pending",
  uploaded: "Pending",
  mapped: "Pending",
} as const

const inputClass = formControlClass

type FieldToHeader = Partial<Record<FieldKey, string>>

/** The API maps header -> field; the page edits field -> header. */
function invertMapping(mapping: Record<string, string>): FieldToHeader {
  const result: FieldToHeader = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (isFieldKey(field)) result[field] = header
  }
  return result
}

function toApiMapping(fieldToHeader: FieldToHeader): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [field, header] of Object.entries(fieldToHeader)) {
    if (header) result[header] = field
  }
  return result
}

function isStatusKey(value: string): value is keyof typeof batchStatusStyle {
  return value in batchStatusStyle
}

function rowName(mapped: Record<string, unknown> | null | undefined) {
  if (!mapped) return ""
  return [mapped.first_name, mapped.last_name]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ")
}

export function ImportMasterlistView() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const [step, setStep] = useState<Step>("select")
  const [file, setFile] = useState<File | null>(null)
  const [upload, setUpload] = useState<ImportUploadPublic | null>(null)
  const [batch, setBatch] = useState<ImportBatchPublic | null>(null)
  const [fieldToHeader, setFieldToHeader] = useState<FieldToHeader>({})
  const [dateOrder, setDateOrder] = useState<DateOrder>("ymd")
  const [duplicateAction, setDuplicateAction] =
    useState<DuplicateAction>("skip")
  const [rowFilter, setRowFilter] = useState<RowFilter>("all")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const onError = (err: Error) => handleError.call(showErrorToast, err)
  const batchId = batch?.id ?? upload?.id

  const historyQuery = useQuery({
    queryKey: ["imports", "history"],
    queryFn: async () =>
      (await ImportsService.listImports({ query: { limit: 10 } })).data,
  })

  const rowsQuery = useQuery({
    queryKey: ["imports", batchId, "rows", rowFilter, pageIndex, pageSize],
    queryFn: async () =>
      (
        await ImportsService.listRows({
          path: { batch_id: batchId as string },
          query: {
            classification: rowFilter === "all" ? undefined : rowFilter,
            skip: pageIndex * pageSize,
            limit: pageSize,
          },
        })
      ).data,
    enabled: step === "preview" && Boolean(batchId),
  })

  function refreshHistory() {
    queryClient.invalidateQueries({ queryKey: ["imports", "history"] })
    queryClient.invalidateQueries({ queryKey: ["reports-summary"] })
  }

  function reset() {
    setStep("select")
    setFile(null)
    setUpload(null)
    setBatch(null)
    setFieldToHeader({})
    setDateOrder("ymd")
    setDuplicateAction("skip")
    setRowFilter("all")
    setPageIndex(0)
  }

  const uploadMutation = useMutation({
    mutationFn: async (chosen: File) =>
      (await ImportsService.uploadImport({ body: { file: chosen } })).data,
    onSuccess: (data) => {
      setUpload(data)
      setBatch(data)
      setFieldToHeader(invertMapping(data.suggested_mapping))
      setStep("map")
      refreshHistory()
    },
    onError,
  })

  const mappingMutation = useMutation({
    mutationFn: async () =>
      (
        await ImportsService.setMapping({
          path: { batch_id: batchId as string },
          body: {
            mapping: toApiMapping(fieldToHeader),
            date_order: dateOrder,
            duplicate_action: duplicateAction,
          },
        })
      ).data,
    onSuccess: (data) => {
      setBatch(data)
      setRowFilter("all")
      setPageIndex(0)
      setStep("preview")
    },
    onError,
  })

  const commitMutation = useMutation({
    mutationFn: async () =>
      (
        await ImportsService.commitImport({
          path: { batch_id: batchId as string },
        })
      ).data,
    onSuccess: (data) => {
      setBatch(data)
      setStep("results")
      queryClient.invalidateQueries({ queryKey: ["residents"] })
      refreshHistory()
    },
    onError: (err: Error) => {
      onError(err)
      refreshHistory()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () =>
      (
        await ImportsService.cancelImport({
          path: { batch_id: batchId as string },
        })
      ).data,
    onSuccess: () => {
      reset()
      refreshHistory()
    },
    onError,
  })

  async function downloadErrors() {
    if (!batchId) return
    try {
      const response = await ImportsService.downloadErrorReport({
        path: { batch_id: batchId },
        responseType: "blob",
      } as Parameters<typeof ImportsService.downloadErrorReport>[0])
      const url = URL.createObjectURL(response.data as unknown as Blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "import-errors.csv"
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      onError(err as Error)
    }
  }

  const required = upload?.required_fields ?? []
  const missingRequired = required.filter(
    (field) => !isFieldKey(field) || !fieldToHeader[field],
  )
  const counts = batch?.counts ?? { new: 0, duplicate: 0, error: 0 }
  const busy =
    uploadMutation.isPending ||
    mappingMutation.isPending ||
    commitMutation.isPending ||
    cancelMutation.isPending
  const canCommit =
    counts.new > 0 || (duplicateAction === "update" && counts.duplicate > 0)
  const rows = rowsQuery.data?.data ?? []
  const rowTotal = rowsQuery.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(rowTotal / pageSize))
  const start = rowTotal ? pageIndex * pageSize + 1 : 0
  const end = Math.min(rowTotal, (pageIndex + 1) * pageSize)
  const stepIndex = STEPS.indexOf(step)

  function fieldLabel(field: string) {
    return isFieldKey(field) ? t(`records.import.fields.${field}`) : field
  }

  function formatNumber(value: number) {
    return formatLocaleNumber(value)
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
          <FileUp className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold">{t("records.import.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("records.import.description")}
          </p>
        </div>
      </div>
      <p
        role="note"
        className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
      >
        {t("records.import.safety")}
      </p>

      <ol
        className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
        aria-label={t("records.import.stepsAria")}
      >
        {STEPS.map((name, index) => (
          <li
            key={name}
            aria-current={step === name ? "step" : undefined}
            className={cn(
              "rounded-md border px-3 py-2 text-center text-sm font-medium",
              step === name
                ? "border-primary bg-primary text-primary-foreground"
                : index < stepIndex
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {index + 1}. {t(`records.import.steps.${name}`)}
          </li>
        ))}
      </ol>

      {step === "select" ? (
        <div className="mt-4">
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:border-brand/50 hover:bg-muted/30">
            <Upload className="size-7 text-brand" aria-hidden="true" />
            <span className="font-semibold">
              {file?.name ?? t("records.import.chooseFile")}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("records.import.formats")}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="min-h-11"
              disabled={!file || busy}
              onClick={() => file && uploadMutation.mutate(file)}
            >
              {uploadMutation.isPending
                ? t("records.import.uploading")
                : t("records.import.uploadContinue")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "map" && upload ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <h3 className="font-semibold">{t("records.import.mapTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("records.import.mapDescription", {
                file: upload.file_name,
                rows: formatNumber(upload.total_rows),
              })}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {upload.importable_fields.filter(isFieldKey).map((field) => {
                const chosen = fieldToHeader[field] ?? ""
                const takenElsewhere = new Set(
                  Object.entries(fieldToHeader)
                    .filter(([other]) => other !== field)
                    .map(([, header]) => header),
                )
                const isRequired = required.includes(field)
                return (
                  <label
                    key={field}
                    className="flex flex-col gap-2 text-sm font-medium"
                  >
                    <span>
                      {fieldLabel(field)}
                      {isRequired ? (
                        <span className="text-destructive">
                          {" "}
                          · {t("records.import.requiredMark")}
                        </span>
                      ) : null}
                    </span>
                    <Select
                      className={cn(inputClass, "font-normal")}
                      value={chosen}
                      onChange={(event) =>
                        setFieldToHeader((current) => ({
                          ...current,
                          [field]: event.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">
                        {isRequired
                          ? t("records.import.chooseColumn")
                          : t("records.import.notInFile")}
                      </option>
                      {upload.headers.map((header) => (
                        <option
                          key={header}
                          value={header}
                          disabled={takenElsewhere.has(header)}
                        >
                          {header}
                        </option>
                      ))}
                    </Select>
                  </label>
                )
              })}
            </div>
            <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                {t("records.import.dateOrderLabel")}
                <Select
                  className={cn(inputClass, "font-normal")}
                  value={dateOrder}
                  onChange={(event) =>
                    setDateOrder(event.target.value as DateOrder)
                  }
                >
                  {DATE_ORDERS.map((order) => (
                    <option key={order} value={order}>
                      {t(`records.import.dateOrders.${order}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                {t("records.import.duplicateLabel")}
                <Select
                  className={cn(inputClass, "font-normal")}
                  value={duplicateAction}
                  onChange={(event) =>
                    setDuplicateAction(event.target.value as DuplicateAction)
                  }
                >
                  {DUPLICATE_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {t(`records.import.duplicateActions.${action}`)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            {missingRequired.length > 0 ? (
              <p
                role="status"
                className="mt-4 text-sm text-amber-700 dark:text-amber-300"
              >
                {t("records.import.mapRequired", {
                  fields: missingRequired.map(fieldLabel).join(", "),
                })}
              </p>
            ) : null}
          </div>

          {upload.sample_rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border">
              <p className="border-b p-3 text-sm font-medium">
                {t("records.import.sampleTitle")}
              </p>
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {upload.headers.map((header) => (
                      <th key={header} className="px-3 py-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upload.sample_rows.map((sample, index) => (
                    <tr key={index} className="border-t">
                      {upload.headers.map((header) => (
                        <td key={header} className="px-3 py-2">
                          {sample[header] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "preview" && batch ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["new", "duplicate", "error"] as const).map((kind) => (
              <div
                key={kind}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <p className="text-sm text-muted-foreground">
                  {t(`records.import.classes.${kind}`)}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {formatNumber(counts[kind] ?? 0)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(`records.import.duplicateNote.${duplicateAction}`)}
          </p>

          <div className="overflow-hidden rounded-xl border">
            <div className="flex flex-wrap gap-2 border-b p-3">
              {ROW_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={rowFilter === filter ? "default" : "outline"}
                  aria-pressed={rowFilter === filter}
                  onClick={() => {
                    setRowFilter(filter)
                    setPageIndex(0)
                  }}
                >
                  {t(`records.import.filters.${filter}`)}
                </Button>
              ))}
            </div>
            {rowsQuery.isLoading ? (
              <LoadingState title={t("records.import.loadingRows")} />
            ) : rowsQuery.isError ? (
              <ErrorState
                title={t("records.import.rowsError")}
                onRetry={() => rowsQuery.refetch()}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                title={t("records.import.noRows")}
                description={t("records.import.noRowsDescription")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {(["row", "name", "result", "problems"] as const).map(
                        (column) => (
                          <th key={column} className="px-4 py-3 font-medium">
                            {t(`records.import.columns.${column}`)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const kind = (row.classification ?? "new") as
                        | "new"
                        | "duplicate"
                        | "error"
                      return (
                        <tr key={row.row_number} className="border-t align-top">
                          <td className="px-4 py-3">
                            {formatNumber(row.row_number)}
                          </td>
                          <td className="px-4 py-3">
                            {rowName(row.mapped) || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={
                                statusStyles[classificationStyle[kind]]
                              }
                            >
                              {t(`records.import.classes.${kind}`)}
                            </Badge>
                            {kind === "duplicate" && row.duplicate_scope ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {row.duplicate_scope === "file"
                                  ? t("records.import.scope.file")
                                  : t("records.import.scope.existing")}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.errors.length === 0
                              ? "—"
                              : row.errors.map((error) => (
                                  <p key={`${error.field}-${error.message}`}>
                                    {fieldLabel(error.field)}:{" "}
                                    {importProblemText(error.message, t)}
                                  </p>
                                ))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <TablePagination
              start={start}
              end={end}
              total={rowTotal}
              pageIndex={pageIndex}
              pageCount={pageCount}
              onPageChange={setPageIndex}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPageIndex(0)
              }}
            />
          </div>
          {counts.error > 0 ? (
            <Button type="button" variant="outline" onClick={downloadErrors}>
              {t("records.import.downloadErrors")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {step === "results" && batch ? (
        <div className="mt-4 space-y-4">
          <p
            role="status"
            className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            {t("records.import.done", { file: batch.file_name })}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["created", "updated", "skipped", "failed"] as const).map(
              (kind) => (
                <div
                  key={kind}
                  className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
                >
                  <p className="text-sm text-muted-foreground">
                    {t(`records.import.resultLabels.${kind}`)}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatNumber(batch.result?.[kind] ?? 0)}
                  </p>
                </div>
              ),
            )}
          </div>
          {(batch.result?.failed ?? 0) > 0 ? (
            <Button type="button" variant="outline" onClick={downloadErrors}>
              {t("records.import.downloadErrors")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-between gap-3 border-t pt-4">
        {step === "results" ? (
          <span />
        ) : step === "select" ? (
          <span />
        ) : (
          <Button
            className="min-h-11"
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              step === "preview" ? setStep("map") : setCancelOpen(true)
            }
          >
            {step === "preview"
              ? t("records.import.back")
              : t("records.import.cancelImport")}
          </Button>
        )}
        {step === "map" ? (
          <Button
            className="min-h-11"
            type="button"
            disabled={busy || missingRequired.length > 0}
            onClick={() => mappingMutation.mutate()}
          >
            {mappingMutation.isPending
              ? t("records.import.checking")
              : t("records.import.checkFile")}
          </Button>
        ) : null}
        {step === "preview" ? (
          <div className="flex flex-wrap gap-3">
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setCancelOpen(true)}
            >
              {t("records.import.cancelImport")}
            </Button>
            <Button
              className="min-h-11"
              type="button"
              disabled={busy || !canCommit}
              onClick={() => setConfirmOpen(true)}
            >
              {commitMutation.isPending
                ? t("records.import.importing")
                : t("records.import.commit")}
            </Button>
          </div>
        ) : null}
        {step === "results" ? (
          <Button className="min-h-11" type="button" onClick={reset}>
            {t("records.import.another")}
          </Button>
        ) : null}
      </div>

      <section className="mt-6 border-t pt-4" aria-labelledby="import-history">
        <h3 id="import-history" className="font-semibold">
          {t("records.import.historyTitle")}
        </h3>
        {historyQuery.isError ? (
          <ErrorState
            title={t("records.import.historyError")}
            onRetry={() => historyQuery.refetch()}
          />
        ) : (historyQuery.data?.data.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("records.import.historyEmpty")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {(["date", "file", "by", "status", "outcome"] as const).map(
                    (column) => (
                      <th key={column} className="px-4 py-3 font-medium">
                        {t(`records.import.history.${column}`)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {historyQuery.data?.data.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3">
                      {formatLocaleDate(new Date(item.created_at), {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "Asia/Manila",
                      })}
                    </td>
                    <td className="px-4 py-3">{item.file_name}</td>
                    <td className="px-4 py-3">
                      {item.created_by_email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          isStatusKey(item.status)
                            ? statusStyles[batchStatusStyle[item.status]]
                            : undefined
                        }
                      >
                        {isStatusKey(item.status)
                          ? t(`records.import.status.${item.status}`)
                          : item.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.result
                        ? t("records.import.history.outcomeText", {
                            created: formatNumber(item.result.created ?? 0),
                            updated: formatNumber(item.result.updated ?? 0),
                            skipped: formatNumber(item.result.skipped ?? 0),
                            failed: formatNumber(item.result.failed ?? 0),
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("records.import.confirmTitle")}
        description={t("records.import.confirmDescription", {
          n: formatNumber(counts.new),
        })}
        confirmLabel={t("records.import.commit")}
        onConfirm={() => {
          setConfirmOpen(false)
          commitMutation.mutate()
        }}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("records.import.cancelTitle")}
        description={t("records.import.cancelDescription")}
        confirmLabel={t("records.import.cancelImport")}
        destructive
        onConfirm={() => {
          setCancelOpen(false)
          cancelMutation.mutate()
        }}
      />
    </section>
  )
}
