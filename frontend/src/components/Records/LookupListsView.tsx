import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Save, Trash2, X } from "lucide-react"
import { useState, type FormEvent } from "react"

import { LookupsService, type LookupItem } from "@/client"
import { ConfirmDialog } from "@/components/Common/ConfirmDialog"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/FeedbackState"
import { formControlClass } from "@/components/Common/formStyles"
import { Button } from "@/components/ui/button"
import { readApiError } from "@/lib/residents"

type LookupKind = "street" | "association"
type LookupAction = "create" | "rename" | "delete"

async function changeLookup(
  kind: LookupKind,
  action: LookupAction,
  name?: string,
  id?: number,
): Promise<LookupItem | undefined> {
  if (action === "create") {
    if (!name) throw new Error("Enter a name.")
    return kind === "street"
      ? (await LookupsService.createStreet({ body: { name } })).data
      : (await LookupsService.createTricycleAssociation({ body: { name } })).data
  }

  if (id === undefined) throw new Error("The selected list item is missing.")
  if (action === "rename") {
    if (!name) throw new Error("Enter a name.")
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

  if (kind === "street") {
    await LookupsService.deleteStreet({ path: { street_id: id } })
  } else {
    await LookupsService.deleteTricycleAssociation({ path: { item_id: id } })
  }
  return undefined
}

function LookupListPanel({
  kind,
  title,
  description,
  items,
  loading,
  failed,
  retry,
}: {
  kind: LookupKind
  title: string
  description: string
  items: LookupItem[]
  loading: boolean
  failed: boolean
  retry: () => void
}) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<LookupItem | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const mutation = useMutation({
    mutationFn: (input: {
      action: LookupAction
      name?: string
      id?: number
    }) => changeLookup(kind, input.action, input.name, input.id),
    onSuccess: (_result, input) => {
      setError("")
      setNotice(
        input.action === "create"
          ? "List item added."
          : input.action === "rename"
            ? "List item renamed."
            : "List item deleted.",
      )
      setNewName("")
      setEditingId(null)
      setEditingName("")
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ["lookups"] })
    },
    onError: (caught, input) => {
      const failure = readApiError(caught)
      const status = (caught as { response?: { status?: number } }).response?.status
      setNotice("")
      setError(
        status === 409 && input.action === "delete"
          ? "This item is already used by a record. It cannot be deleted. Rename it only if the new name is correct for existing records."
          : failure.message,
      )
    },
  })

  function startEdit(item: LookupItem) {
    setError("")
    setNotice("")
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
    if (!name) return
    mutation.mutate({ action: "create", name })
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={submitCreate} className="flex flex-col gap-2 border-b p-4 sm:flex-row">
        <label className="sr-only" htmlFor={kind + "-new-name"}>
          New {kind === "street" ? "street" : "association"} name
        </label>
        <input
          id={kind + "-new-name"}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          className={formControlClass}
          placeholder={kind === "street" ? "Enter street name" : "Enter association name"}
          maxLength={150}
        />
        <Button type="submit" disabled={!newName.trim() || mutation.isPending}>
          <Plus aria-hidden="true" />
          Add
        </Button>
      </form>

      {notice ? (
        <p role="status" className="border-b px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="border-b px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingState title={"Loading " + title.toLowerCase() + "..."} />
      ) : failed ? (
        <ErrorState
          title={"Could not load " + title.toLowerCase()}
          description="Check your connection and try again."
          onRetry={retry}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={"No " + title.toLowerCase() + " yet"}
          description="Add the names supplied and confirmed by the barangay office."
        />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {editingId === item.id ? (
                <>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Edit {item.name}</span>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className={formControlClass}
                      maxLength={150}
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
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                      <X aria-hidden="true" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="min-w-0 break-words font-medium">{item.name}</span>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                      <Pencil aria-hidden="true" />
                      Rename
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setError("")
                        setNotice("")
                        setDeleteTarget(item)
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={"Delete " + (kind === "street" ? "street" : "association") + "?"}
        description={
          "Delete " +
          (deleteTarget?.name ?? "this item") +
          "? Items already used by resident or franchise records cannot be deleted."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) mutation.mutate({ action: "delete", id: deleteTarget.id })
        }}
      />
    </section>
  )
}

export function LookupListsView() {
  const streetsQuery = useQuery({
    queryKey: ["lookups", "streets"],
    queryFn: async () => (await LookupsService.listStreets()).data,
  })
  const associationsQuery = useQuery({
    queryKey: ["lookups", "tricycle-associations"],
    queryFn: async () =>
      (await LookupsService.listTricycleAssociations()).data,
  })

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <LookupListPanel
        kind="street"
        title="Streets"
        description="Used in resident addresses and document issuance."
        items={streetsQuery.data ?? []}
        loading={streetsQuery.isLoading}
        failed={streetsQuery.isError}
        retry={() => void streetsQuery.refetch()}
      />
      <LookupListPanel
        kind="association"
        title="Tricycle Associations"
        description="Used when recording franchise clearances."
        items={associationsQuery.data ?? []}
        loading={associationsQuery.isLoading}
        failed={associationsQuery.isError}
        retry={() => void associationsQuery.refetch()}
      />
    </div>
  )
}
