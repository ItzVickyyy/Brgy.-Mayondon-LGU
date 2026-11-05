import { CreditCard, FileCheck2, UserRound, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { formControlClass } from "@/components/Common/formStyles"
import { statusStyles } from "@/components/Common/statusStyles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import type { ResidentRecord } from "@/components/Records/records-sample-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function residentBirthdateAge(value: string) {
  const birthdate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(birthdate.getTime())) return value
  const today = new Date()
  let age = today.getFullYear() - birthdate.getFullYear()
  if (
    today.getMonth() < birthdate.getMonth() ||
    (today.getMonth() === birthdate.getMonth() &&
      today.getDate() < birthdate.getDate())
  ) {
    age -= 1
  }
  return `${birthdate.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })} · ${age} yrs`
}

type ResidentProfileDialogProps = {
  resident: ResidentRecord | null
  onOpenChange: (open: boolean) => void
  profileTab: string
  onProfileTabChange: (tab: string) => void
  editable?: boolean
  startInEditMode?: boolean
  onSave?: (resident: ResidentRecord) => void
}

export function ResidentProfileDialog({
  resident,
  onOpenChange,
  profileTab,
  onProfileTabChange,
  editable = false,
  startInEditMode = false,
  onSave,
}: ResidentProfileDialogProps) {
  const [isEditing, setIsEditing] = useState(startInEditMode)
  const [editName, setEditName] = useState("")
  const [editBirthdate, setEditBirthdate] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editResidentType, setEditResidentType] = useState("")
  const [editIdNumber, setEditIdNumber] = useState("")
  const [editIdStatus, setEditIdStatus] = useState<ResidentRecord["idStatus"]>("Valid")
  const [editRegistration, setEditRegistration] = useState<ResidentRecord["registration"]>("Registered")

  useEffect(() => {
    setIsEditing(startInEditMode)
    setEditName(resident?.name ?? "")
    setEditBirthdate(resident?.birthdate ?? "")
    setEditAddress(resident?.address ?? "")
    setEditResidentType(resident?.residentType ?? "")
    setEditIdNumber(resident?.idNumber ?? "")
    setEditIdStatus(resident?.idStatus ?? "Valid")
    setEditRegistration(resident?.registration ?? "Registered")
  }, [resident, startInEditMode])
  return (
    <Dialog open={Boolean(resident)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Resident Profile</DialogTitle>
          <DialogDescription>
            Review resident details, family and sector information, ID records,
            and issuance history.
          </DialogDescription>
        </DialogHeader>
        {resident ? (
          <>
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <UserRound className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{resident.name}</p>
                <p className="text-sm text-muted-foreground">
                  {resident.id} · {resident.address}
                </p>
              </div>
              <Badge variant="outline" className={statusStyles[resident.status]}>{resident.status}</Badge>
            </div>
            <div
              className="flex flex-wrap gap-2 border-b pb-3"
              role="tablist"
              aria-label="Resident profile sections"
            >
              {[
                "Details",
                "Family & Sector",
                "Barangay ID",
                "Issuance History",
              ].map((tab) => (
                <Button
                  key={tab}
                  type="button"
                  role="tab"
                  variant={profileTab === tab ? "default" : "ghost"}
                  aria-selected={profileTab === tab}
                  onClick={() => onProfileTabChange(tab)}
                  className="min-h-11 rounded-md px-3"
                >
                  {tab}
                </Button>
              ))}
            </div>
            {profileTab === "Details" ? (
              isEditing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Full name
                    <input value={editName} onChange={(event) => setEditName(event.target.value)} className={formControlClass} required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Birthdate
                    <input type="date" value={editBirthdate} onChange={(event) => setEditBirthdate(event.target.value)} className={formControlClass} required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
                    Complete address
                    <input value={editAddress} onChange={(event) => setEditAddress(event.target.value)} className={formControlClass} required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Resident type
                    <select value={editResidentType} onChange={(event) => setEditResidentType(event.target.value)} className={formControlClass}>
                      {["Existing resident", "New / renting resident"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Barangay ID number
                    <input value={editIdNumber} onChange={(event) => setEditIdNumber(event.target.value)} className={formControlClass} required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Barangay ID status
                    <select value={editIdStatus} onChange={(event) => setEditIdStatus(event.target.value as ResidentRecord["idStatus"])} className={formControlClass}>
                      {["Valid", "Expiring soon", "Expired", "None"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Registration
                    <select value={editRegistration} onChange={(event) => setEditRegistration(event.target.value as ResidentRecord["registration"])} className={formControlClass}>
                      <option>Registered</option>
                      <option>Unregistered</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Resident reference", resident.id],
                    ["Full name", resident.name],
                    ["Birthdate / age", residentBirthdateAge(resident.birthdate)],
                    ["Complete address", resident.address],
                    ["Resident type", resident.residentType],
                    ["Barangay ID number", resident.idNumber],
                    ["Barangay ID status", resident.idStatus],
                    ["Registration", resident.registration],
                    ["Record status", resident.status],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-card p-4">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-1 font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              )
            ) : null}
            {profileTab === "Family & Sector" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border bg-card p-4">
                  <Users className="size-5 text-brand" aria-hidden="true" />
                  <h3 className="mt-2 font-semibold">Family details</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Household reference, family members, and relationships.
                  </p>
                </section>
                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <UserRound
                    className="size-5 text-brand"
                    aria-hidden="true"
                  />
                  <h3 className="mt-2 font-semibold">
                    Beneficiary and sector details
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Beneficiary information and sector classifications.
                  </p>
                </section>
              </div>
            ) : null}
            {profileTab === "Barangay ID" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <CreditCard
                    className="size-5 text-brand"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Barangay ID number
                  </p>
                  <p className="mt-1 font-semibold">{resident.idNumber}</p>
                </section>
                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    Registration status
                  </p>
                  <p className="mt-1 font-semibold">{resident.registration}</p>
                </section>
              </div>
            ) : null}
            {profileTab === "Issuance History" ? (
              <section className="rounded-xl border bg-card p-4 sm:p-5">
                <FileCheck2
                  className="size-6 text-brand"
                  aria-hidden="true"
                />
                <h3 className="mt-2 font-semibold">Issuance history</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Documents associated with this resident will appear here when
                  the issuance records are connected.
                </p>
              </section>
            ) : null}
            {editable && profileTab === "Details" ? (
              <div className="flex justify-end gap-2">
                {isEditing ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button
                      type="button"
                      disabled={!editName.trim() || !editBirthdate || !editAddress.trim() || !editIdNumber.trim()}
                      onClick={() => {
                        if (!resident || !onSave) return
                        onSave({
                          ...resident,
                          name: editName.trim(),
                          birthdate: editBirthdate,
                          address: editAddress.trim(),
                          residentType: editResidentType,
                          idNumber: editIdNumber.trim(),
                          idStatus: editIdStatus,
                          registration: editRegistration,
                        })
                        setIsEditing(false)
                      }}
                    >
                      Save changes
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>Edit details</Button>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
