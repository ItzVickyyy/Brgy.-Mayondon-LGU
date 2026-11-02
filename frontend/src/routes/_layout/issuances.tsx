import { createFileRoute } from "@tanstack/react-router"
import {
  CalendarDays,
  CheckCircle2,
  Eraser,
  Eye,
  FileCheck2,
  FileText,
  Plus,
  Printer,
  Search,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import { EmptyState } from "@/components/Common/FeedbackState"
import { RowActions } from "@/components/Common/RowActions"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import {
  type DocumentField,
  documentFields,
  documentTypes,
  type IssuanceRecord,
  sampleIssuances,
} from "@/components/Issuances/config"
import { FormSection, SummaryCard } from "@/components/Issuances/IssuanceLayout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { pageTitle } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/issuances")({
  component: IssuancesManagement,
  head: () => ({ meta: [{ title: pageTitle("Issuances Management") }] }),
})

const inputClassName = formControlClass
const labelClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-medium"

function localDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function createDefaultFormValues(type: string) {
  const today = localDateValue()
  return Object.fromEntries(
    (documentFields[type] ?? [])
      .filter((field) => field.defaultToday)
      .map((field) => [field.name, today]),
  ) as Record<string, string>
}

function calculateAge(birthdate: string) {
  if (!birthdate) return ""
  const birth = new Date(`${birthdate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return ""
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const birthdayHasNotOccurred =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (birthdayHasNotOccurred) age -= 1
  return age >= 0 ? String(age) : ""
}

function formatDate(value: string) {
  if (!value) return "Not entered"
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
}

function IssuancesManagement() {
  const [isIssuanceModalOpen, setIsIssuanceModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState(documentTypes[0])
  const [search, setSearch] = useState("")
  const [historyType, setHistoryType] = useState("All document types")
  const [historyStatus, setHistoryStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [historyRecords, setHistoryRecords] = useState<IssuanceRecord[]>(sampleIssuances)
  const [pendingAction, setPendingAction] = useState<{ record: IssuanceRecord; action: "void" | "correct" | "discard" } | null>(null)
  const [correctionReason, setCorrectionReason] = useState("")
  const [correctionTarget, setCorrectionTarget] = useState<IssuanceRecord | null>(null)
  const [continueTarget, setContinueTarget] = useState<IssuanceRecord | null>(null)
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    createDefaultFormValues(documentTypes[0]),
  )
  const [drafts, setDrafts] = useState<IssuanceRecord[]>([])
  const [printRecord, setPrintRecord] = useState<IssuanceRecord | null>(null)
  const [viewRecord, setViewRecord] = useState<IssuanceRecord | null>(null)
  const [notice, setNotice] = useState("")

  const fields = documentFields[selectedType] ?? []
  const currentName = formValues.name?.trim() || "Name not entered"
  const currentDate = formValues.date || ""
  const allRecords = useMemo(() => [...drafts, ...historyRecords], [drafts, historyRecords])
  const filteredIssuances = useMemo(
    () =>
      allRecords
        .filter((item) => {
          const query = search.trim().toLowerCase()
          const matchesSearch = [
            item.id,
            item.resident,
            item.type,
            item.date,
            item.status,
            item.purpose ?? "",
          ].some((value) => value.toLowerCase().includes(query))
          const matchesType = historyType === "All document types" || item.type === historyType
          const matchesStatus = historyStatus === "all" || item.status === historyStatus
          return matchesSearch && matchesType && matchesStatus &&
            (!startDate || item.date >= startDate) &&
            (!endDate || item.date <= endDate)
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allRecords, endDate, historyStatus, historyType, search, startDate],
  )

  const issuedCount = allRecords.filter(
    (item) => item.status === "Issued",
  ).length
  const latestDate =
    allRecords
      .map((item) => item.date)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? ""
  const typeCounts = allRecords.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
  const hasFilters = search.trim() !== "" || historyType !== "All document types" || historyStatus !== "all" || startDate !== "" || endDate !== ""

  function updateField(name: string, value: string) {
    setFormValues((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "birthdate" ? { age: calculateAge(value) } : {}),
    }))
    setNotice("")
  }

  function changeDocumentType(value: string) {
    setSelectedType(value)
    setFormValues((previous) => ({
      ...createDefaultFormValues(value),
      ...previous,
    }))
    setNotice("")
    setPrintRecord(null)
  }

  function clearForm() {
    setFormValues(createDefaultFormValues(selectedType))
    setNotice("")
    setPrintRecord(null)
  }

  function saveIssuance() {
    if (!formValues.name?.trim()) {
      setNotice("Enter the resident's name before saving the issuance.")
      return
    }
    if (continueTarget) {
      setHistoryRecords((previous) =>
        previous.map((item) =>
          item.id === continueTarget.id
            ? { ...item, resident: currentName, date: currentDate, status: "Issued", purpose: formValues.purpose || item.purpose, validUntil: formValues.validUntil || item.validUntil, fields: { ...formValues } }
            : item,
        ),
      )
      setNotice(`${continueTarget.id} was continued and marked as issued.`)
      setContinueTarget(null)
      setIsIssuanceModalOpen(false)
      return
    }
    const nextId = `ISS-${String(allRecords.length + 1).padStart(4, "0")}`
    const record: IssuanceRecord = {
      id: nextId,
      resident: currentName,
      type: selectedType,
      date: currentDate,
      status: "Issued",
      purpose: formValues.purpose,
      validUntil: formValues.validUntil,
      correctionReason: correctionTarget ? correctionReason : undefined,
      fields: { ...formValues },
    }
    setDrafts((previous) => [record, ...previous])
    setNotice(
      correctionTarget
        ? `${record.id} was created as a corrected record. The original ${correctionTarget.id} remains in history.`
        : `${record.id} was recorded as issued. You can now print the record.`,
    )
    setCorrectionTarget(null)
    setCorrectionReason("")
    setIsIssuanceModalOpen(false)
  }

  function preparePrint(record?: IssuanceRecord) {
    setPrintRecord(
      record ?? {
        id: "PRINT-PREVIEW",
        resident: currentName,
        type: selectedType,
        date: currentDate,
        status: "Pending",
        fields: { ...formValues },
      },
    )
    setNotice("")
  }

  function printNow(record?: IssuanceRecord) {
    preparePrint(record)
    window.setTimeout(() => window.print(), 100)
  }

  function renderField(field: DocumentField) {
    const wide =
      field.fullWidth ||
      field.type === "textarea" ||
      field.type === "checkboxes"
    const value = formValues[field.name] ?? ""
    const wrapperClass = cn(labelClassName, wide && "md:col-span-2")

    if (field.type === "checkboxes") {
      const checkedValues = value.split("||").filter(Boolean)
      return (
        <fieldset key={field.name} className={wrapperClass}>
          <legend className="mb-1.5 text-sm font-medium">{field.label}</legend>
          <div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((option) => {
              const checked = checkedValues.includes(option)
              return (
                <label
                  key={option}
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-normal transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...checkedValues, option]
                        : checkedValues.filter((item) => item !== option)
                      updateField(field.name, next.join("||"))
                    }}
                    className="size-4 rounded border-input accent-primary"
                  />
                  {option}
                </label>
              )
            })}
          </div>
        </fieldset>
      )
    }

    return (
      <div key={field.name} className={wrapperClass}>
        <label htmlFor={`field-${field.name}`}>{field.label}</label>
        {field.type === "select" ? (
          <select
            id={`field-${field.name}`}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            className={inputClassName}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            id={`field-${field.name}`}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            rows={3}
            className={cn(inputClassName, "h-auto py-2")}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        ) : (
          <input
            id={`field-${field.name}`}
            type={field.type ?? "text"}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            readOnly={field.name === "age"}
            className={cn(
              inputClassName,
              field.name === "age" && "bg-muted/50",
            )}
            placeholder={
              field.name === "age"
                ? "Calculated from birthdate"
                : field.type === "date"
                  ? undefined
                  : `Enter ${field.label.toLowerCase()}`
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <style>
        {
          "@media print { body * { visibility: hidden !important; } #issuance-print, #issuance-print * { visibility: visible !important; } #issuance-print { display: block !important; position: fixed; inset: 0; width: 100%; padding: 24px; color: #111 !important; background: white !important; } }"
        }
      </style>

      {/* Page header */}
      <header className="print:hidden flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Issuance Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prepare Barangay IDs and certificates, print records, and review
            past issuances.
          </p>
        </div>
        <Button
          size="default"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => setIsIssuanceModalOpen(true)}
        >
          <Plus aria-hidden="true" />
          New Issuance
        </Button>
      </header>

      {notice && (
        <div
          role="status"
          className="print:hidden flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="icon" className="size-11" onClick={() => setNotice("")} aria-label="Dismiss message">
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="print:hidden grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={FileCheck2}
          label="Total issued"
          value={issuedCount}
          hint="All recorded issuances"
        />
        <SummaryCard
          icon={CalendarDays}
          label="Latest issuance"
          value={latestDate ? formatDate(latestDate) : "None yet"}
          hint="Most recent record date"
        />
        <SummaryCard
          icon={FileText}
          label="Most issued document"
          value={topType ? topType[1] : 0}
          hint={topType ? topType[0] : "No records yet"}
        />
      </div>

      {/* New issuance dialog */}
      <Dialog open={isIssuanceModalOpen} onOpenChange={setIsIssuanceModalOpen}>
        <DialogContent className="print:hidden flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6">
            <DialogTitle className="text-lg">New Issuance</DialogTitle>
            <DialogDescription>
              Choose a document type, then fill in the details once. Required:
              resident name.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => event.preventDefault()}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-5 py-5 sm:px-6">
              <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                <label className={labelClassName}>
                  <span className="text-sm font-semibold">Document type</span>
                  <select
                    value={selectedType}
                    onChange={(event) => changeDocumentType(event.target.value)}
                    className={inputClassName}
                  >
                    {documentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <FormSection
                title={selectedType}
                description="Fields marked on the approved form. Date fields default to today."
              >
                {fields.map(renderField)}
              </FormSection>

              <section className="rounded-xl border border-dashed bg-card p-4 text-sm sm:p-5">
                <p className="text-sm font-semibold">Summary</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Document</dt>
                    <dd className="mt-0.5 font-medium">{selectedType}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Resident</dt>
                    <dd className="mt-0.5 font-medium">{currentName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Date</dt>
                    <dd className="mt-0.5 font-medium">
                      {formatDate(currentDate)}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            <DialogFooter className="border-t bg-card px-5 py-3 sm:items-center sm:px-6">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="sm:mr-auto"
                onClick={clearForm}
              >
                <Eraser aria-hidden="true" />
                Clear form
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => printNow()}
              >
                <Printer aria-hidden="true" />
                Print preview
              </Button>
              <Button type="button" size="lg" onClick={saveIssuance}>
                <FileCheck2 aria-hidden="true" />
                Save as issued
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record details dialog */}
      <Dialog
        open={viewRecord !== null}
        onOpenChange={(open) => !open && setViewRecord(null)}
      >
        <DialogContent className="print:hidden sm:max-w-lg">
          {viewRecord && (
            <>
              <DialogHeader>
                <DialogTitle>{viewRecord.id}</DialogTitle>
                <DialogDescription>{viewRecord.type}</DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Resident</dt>
                  <dd className="mt-0.5 font-medium">{viewRecord.resident}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Date</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDate(viewRecord.date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge
                      variant="outline"
                      className={statusStyles[viewRecord.status]}
                    >
                      {viewRecord.status}
                    </Badge>
                  </dd>
                </div>
              </dl>
              {Object.keys(viewRecord.fields).length === 0 && (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Record details are unavailable.
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewRecord(null)}>
                  Close
                </Button>
                <Button onClick={() => printNow(viewRecord)}>
                  <Printer aria-hidden="true" />
                  Print
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* History */}
      <section className="print:hidden overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Issuance History</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Showing {filteredIssuances.length} of {allRecords.length}{" "}
                records
              </p>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setSearch("")
                  setHistoryType("All document types")
                }}
              >
                <X aria-hidden="true" />
                Reset filters
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search issuance history</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by reference, resident, type, or date"
                className={cn(inputClassName, "pl-9")}
              />
            </label>
            <label className="sm:w-72">
              <span className="sr-only">Filter by document type</span>
              <select
                value={historyType}
                onChange={(event) => setHistoryType(event.target.value)}
                className={inputClassName}
              >
                <option>All document types</option>
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium sm:px-5">
                  Record ID
                </th>
                <th scope="col" className="px-4 py-3 align-middle font-medium sm:px-5">
                  Resident
                </th>
                <th scope="col" className="px-4 py-3 align-middle font-medium sm:px-5">
                  Document
                </th>
                <th scope="col" className="px-4 py-3 align-middle font-medium sm:px-5">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 align-middle font-medium sm:px-5">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium sm:px-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIssuances.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5 font-mono text-xs font-medium">
                    {item.id}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5 font-medium">{item.resident}</td>
                  <td className="max-w-xs px-4 py-3 align-middle sm:px-5 text-muted-foreground">
                    {item.type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle sm:px-5 text-muted-foreground">
                    {formatDate(item.date)}
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Badge
                      variant="outline"
                      className={statusStyles[item.status]}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() => setViewRecord(item)}
                        aria-label={`View ${item.id}`}
                      >
                        <Eye aria-hidden="true" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() => printNow(item)}
                        aria-label={`Print ${item.id}`}
                      >
                        <Printer aria-hidden="true" />
                        Print
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y md:hidden">
          {filteredIssuances.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.resident}</p>
                  <p className="text-sm text-muted-foreground">{item.type}</p>
                </div>
                <Badge variant="outline" className={statusStyles[item.status]}>
                  {item.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{item.id}</span> ·{" "}
                {formatDate(item.date)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 flex-1"
                  onClick={() => setViewRecord(item)}
                >
                  <Eye aria-hidden="true" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => printNow(item)}
                >
                  <Printer aria-hidden="true" />
                  Print
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {filteredIssuances.length === 0 && (
          <EmptyState
            title="No records found"
            description="Try a different search or document type, or create a new issuance."
          />
        )}
      </section>

      <section
        id="issuance-print"
        className="hidden print:block p-6 text-black"
      >
        <p className="text-sm">
          Selected document: {printRecord?.type ?? selectedType}
        </p>
        <p className="text-sm" />
      </section>
    </div>
  )
}
