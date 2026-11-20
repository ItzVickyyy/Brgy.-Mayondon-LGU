import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import i18n from "i18next"
import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react"
import { type FormEvent, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { type LookupItem, LookupsService } from "@/client"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { refreshLookups } from "@/components/Issuances/NewIssuance/issuanceApi"
import { Button } from "@/components/ui/button"
import { notify } from "@/lib/notifications"
import { readApiError } from "@/lib/residents"

type LookupKind =
  | "street"
  | "subdivision"
  | "association"
  | "idType"
  | "sector"
  | "purpose"
  | "addressedOffice"
  | "educationalAttainment"
type LookupAction = "create" | "rename" | "delete"

/** The most characters a name may have: it matches the column in the database. */
const NAME_LIMIT: Record<LookupKind, number> = {
  street: 150,
  subdivision: 150,
  association: 150,
  idType: 50,
  sector: 100,
  purpose: 150,
  addressedOffice: 150,
  educationalAttainment: 150,
}

async function changeLookup(
  kind: LookupKind,
  action: LookupAction,
  name?: string,
  id?: number,
): Promise<LookupItem | undefined> {
  if (action === "create") {
    if (!name) throw new Error(i18n.t("records.lookups.enterName"))
    if (kind === "idType")
      return (await LookupsService.createIdType({ body: { name } })).data
    if (kind === "sector")
      return (await LookupsService.createSector({ body: { name } })).data
    if (kind === "purpose")
      return (await LookupsService.createIssuancePurpose({ body: { name } }))
        .data
    if (kind === "addressedOffice")
      return (await LookupsService.createAddressedOffice({ body: { name } }))
        .data
    if (kind === "educationalAttainment")
      return (
        await LookupsService.createEducationalAttainment({ body: { name } })
      ).data
    if (kind === "subdivision")
      return (await LookupsService.createSubdivision({ body: { name } })).data
    return kind === "street"
      ? (await LookupsService.createStreet({ body: { name } })).data
      : (await LookupsService.createTricycleAssociation({ body: { name } }))
          .data
  }

  if (id === undefined) throw new Error(i18n.t("records.lookups.itemMissing"))
  if (action === "rename") {
    if (!name) throw new Error(i18n.t("records.lookups.enterName"))
    if (kind === "idType")
      return (
        await LookupsService.renameIdType({
          path: { item_id: id },
          body: { name },
        })
      ).data
    if (kind === "sector")
      return (
        await LookupsService.renameSector({
          path: { item_id: id },
          body: { name },
        })
      ).data
    if (kind === "purpose")
      return (
        await LookupsService.renameIssuancePurpose({
          path: { item_id: id },
          body: { name },
        })
      ).data
    if (kind === "addressedOffice")
      return (
        await LookupsService.renameAddressedOffice({
          path: { item_id: id },
          body: { name },
        })
      ).data
    if (kind === "educationalAttainment")
      return (
        await LookupsService.renameEducationalAttainment({
          path: { item_id: id },
          body: { name },
        })
      ).data
    if (kind === "subdivision")
      return (
        await LookupsService.renameSubdivision({
          path: { item_id: id },
          body: { name },
        })
      ).data
    return kind === "street"
      ? (
          await LookupsService.renameStreet({
            path: { street_id: id },
            body: { name },
          })
        ).data
      : (
          await LookupsService.renameTricycleAssociation({
            path: { item_id: id },
            body: { name },
          })
        ).data
  }

  if (kind === "idType") {
    await LookupsService.deleteIdType({ path: { item_id: id } })
  } else if (kind === "sector") {
    await LookupsService.deleteSector({ path: { item_id: id } })
  } else if (kind === "purpose") {
    await LookupsService.deleteIssuancePurpose({ path: { item_id: id } })
  } else if (kind === "addressedOffice") {
    await LookupsService.deleteAddressedOffice({ path: { item_id: id } })
  } else if (kind === "educationalAttainment") {
    await LookupsService.deleteEducationalAttainment({ path: { item_id: id } })
  } else if (kind === "subdivision") {
    await LookupsService.deleteSubdivision({ path: { item_id: id } })
  } else if (kind === "street") {
    await LookupsService.deleteStreet({ path: { street_id: id } })
  } else {
    await LookupsService.deleteTricycleAssociation({ path: { item_id: id } })
  }
  return undefined
}

export function LookupListPanel({
  kind,
  items,
  loading,
  failed,
  retry,
}: {
  kind: LookupKind
  items: LookupItem[]
  loading: boolean
  failed: boolean
  retry: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<LookupItem | null>(null)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("")
  const newNameInput = useRef<HTMLInputElement>(null)

  // Alphabetical, numbers in natural order, so a new name lands where it belongs.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    [items],
  )
  const query = filter.trim().toLowerCase()
  const shown = query
    ? sorted.filter((item) => item.name.toLowerCase().includes(query))
    : sorted

  const mutation = useMutation({
    mutationFn: (input: { action: LookupAction; name?: string; id?: number }) =>
      changeLookup(kind, input.action, input.name, input.id),
    onSuccess: (_result, input) => {
      setError("")
      notify({
        key:
          input.action === "create"
            ? "records.lookups.notices.added"
            : input.action === "rename"
              ? "records.lookups.notices.renamed"
              : "records.lookups.notices.deleted",
      })
      setNewName("")
      setEditingId(null)
      setEditingName("")
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ["lookups"] })
      // The New Issuance form keeps its own copy of these lists: make it read them again.
      refreshLookups()
      void queryClient.invalidateQueries({ queryKey: ["issuance-lookups"] })
    },
    onError: (caught, input) => {
      const failure = readApiError(caught)
      const status = (caught as { response?: { status?: number } }).response
        ?.status
      setError(
        status === 409 && input.action === "delete"
          ? t("records.lookups.inUse")
          : failure.message,
      )
    },
  })

  function startEdit(item: LookupItem) {
    setError("")
    setEditingId(item.id)
    setEditingName(item.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName("")
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) {
      // The Add button stays clickable; an empty name is explained, not silently blocked.
      setError(t("records.lookups.nameRequired"))
      newNameInput.current?.focus()
      return
    }
    mutation.mutate({ action: "create", name })
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold tracking-tight">
            {t(`records.lookups.${kind}.title`)}
          </h2>
          {!loading && !failed ? (
            <span
              data-testid={`${kind}-count`}
              className="shrink-0 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
            >
              {t("records.lookups.count", { count: items.length })}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`records.lookups.${kind}.description`)}
        </p>
      </div>

      <form
        onSubmit={submitCreate}
        className="flex flex-col gap-2 border-b p-4 sm:flex-row"
      >
        <label className="sr-only" htmlFor={`${kind}-new-name`}>
          {t(`records.lookups.${kind}.newName`)}
        </label>
        <input
          id={`${kind}-new-name`}
          ref={newNameInput}
          value={newName}
          onChange={(event) => {
            setNewName(event.target.value)
            if (error) setError("")
          }}
          className={formControlClass}
          placeholder={t(`records.lookups.${kind}.placeholder`)}
          maxLength={NAME_LIMIT[kind]}
        />
        <Button type="submit" disabled={mutation.isPending}>
          <Plus aria-hidden="true" />
          {t("records.lookups.add")}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="border-b px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingState title={t(`records.lookups.${kind}.loading`)} />
      ) : failed ? (
        <ErrorState
          title={t(`records.lookups.${kind}.loadError`)}
          description={t("records.lookups.loadErrorDescription")}
          onRetry={retry}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={t(`records.lookups.${kind}.empty`)}
          description={t("records.lookups.emptyDescription")}
        />
      ) : (
        <>
          {items.length > 6 ? (
            <div className="relative border-b p-3">
              <label className="sr-only" htmlFor={`${kind}-filter`}>
                {t("records.lookups.filterLabel")}
              </label>
              <Search
                className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id={`${kind}-filter`}
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className={`${formControlClass} pl-9`}
                placeholder={t("records.lookups.filterPlaceholder")}
              />
            </div>
          ) : null}
          {/* The list scrolls inside the card, so 26 streets never make the
              page (or the neighbouring card) long. */}
          <ul className="max-h-[26rem] divide-y overflow-y-auto">
            {shown.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t("records.lookups.noMatches", { query: filter.trim() })}
              </li>
            ) : null}
            {shown.map((item) => (
              <li
                key={item.id}
                className={`flex gap-2 px-4 py-2.5 hover:bg-muted/30 ${
                  editingId === item.id
                    ? "flex-col sm:flex-row sm:items-center sm:justify-between"
                    : "items-center justify-between"
                }`}
              >
                {editingId === item.id ? (
                  <>
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">
                        {t("records.lookups.editLabel", { name: item.name })}
                      </span>
                      <input
                        // biome-ignore lint/a11y/noAutofocus: the field appears only after the person chose Edit
                        autoFocus
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className={formControlClass}
                        maxLength={NAME_LIMIT[kind]}
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!editingName.trim() || mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            action: "rename",
                            id: item.id,
                            name: editingName.trim(),
                          })
                        }
                      >
                        <Save aria-hidden="true" />
                        {t("records.lookups.save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                      >
                        <X aria-hidden="true" />
                        {t("records.lookups.cancel")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 break-words text-sm font-medium">
                      {item.name}
                    </span>
                    <div className="flex shrink-0 justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground"
                        aria-label={t("records.lookups.renameItem", {
                          name: item.name,
                        })}
                        title={t("records.lookups.rename")}
                        onClick={() => startEdit(item)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive"
                        aria-label={t("records.lookups.deleteItem", {
                          name: item.name,
                        })}
                        title={t("records.lookups.delete")}
                        onClick={() => {
                          setError("")
                          setDeleteTarget(item)
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t(`records.lookups.${kind}.deleteTitle`)}
        description={
          kind === "addressedOffice"
            ? t("records.lookups.addressedOffice.deleteDescription", {
                name: deleteTarget?.name ?? t("records.lookups.thisItem"),
              })
            : kind === "educationalAttainment"
              ? t("records.lookups.educationalAttainment.deleteDescription", {
                  name: deleteTarget?.name ?? t("records.lookups.thisItem"),
                })
              : t("records.lookups.deleteDescription", {
                  name: deleteTarget?.name ?? t("records.lookups.thisItem"),
                })
        }
        confirmLabel={t("records.lookups.delete")}
        destructive
        onConfirm={() => {
          if (deleteTarget)
            mutation.mutate({ action: "delete", id: deleteTarget.id })
        }}
      />
    </section>
  )
}

const LIST_QUERIES = {
  street: { key: "streets", load: () => LookupsService.listStreets() },
  subdivision: {
    key: "subdivisions",
    load: () => LookupsService.listSubdivisions(),
  },
  association: {
    key: "tricycle-associations",
    load: () => LookupsService.listTricycleAssociations(),
  },
  idType: { key: "id-types", load: () => LookupsService.listIdTypes() },
  sector: { key: "sectors", load: () => LookupsService.listSectors() },
  purpose: {
    key: "issuance-purposes",
    load: () => LookupsService.listIssuancePurposes(),
  },
  addressedOffice: {
    key: "addressed-offices",
    load: () => LookupsService.listAddressedOffices(),
  },
  educationalAttainment: {
    key: "educational-attainments",
    load: () => LookupsService.listEducationalAttainments(),
  },
} as const

/** One editable list with its own loading: used inside Issuance settings. */
export function LookupListSection({ kind }: { kind: LookupKind }) {
  const source = LIST_QUERIES[kind]
  const query = useQuery({
    queryKey: ["lookups", source.key],
    queryFn: async () => (await source.load()).data,
  })
  return (
    <LookupListPanel
      kind={kind}
      items={query.data ?? []}
      loading={query.isLoading}
      failed={query.isError}
      retry={() => void query.refetch()}
    />
  )
}
