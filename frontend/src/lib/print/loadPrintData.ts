/**
 * Loads everything buildPrintData needs for one stored issuance (see docs/04-Documents-and-Printing.md section 6).
 * Talks to the issuance API, so it is async. The pure mapping stays in buildPrintData.ts.
 * Tests pass the in-memory copy of the API (`issuanceApi.mock`) instead of the real one.
 */
import { issuanceApi } from "@/components/Issuances/NewIssuance/issuanceApi"
import type { MockIssuance } from "@/components/Issuances/NewIssuance/issuanceTypes"
import {
  buildPrintData,
  type PrintData,
  type PrintLookups,
} from "./buildPrintData"
import { printTemplates } from "./templates"

export type LoadPrintResult =
  | { ok: true; data: PrintData }
  | { ok: false; message: string }

export type PrintApi = {
  getIssuance(id: string): Promise<MockIssuance | undefined>
  getLookups(): Promise<{
    sectors: string[]
    idTypes: string[]
    purposes: string[]
  }>
  getResidentName(id: string): Promise<
    | {
        firstName: string
        middleName: string
        lastName: string
        suffix?: string
      }
    | undefined
  >
  loadResidentPhoto?(id: string): Promise<string | undefined>
  getTricycle(id?: string): Promise<
    | {
        associationName: string
        make: string
        bodyType: string
        motorNumber: string
        color: string
        plateNumber: string
      }
    | undefined
  >
}

export async function loadPrintData(
  issuanceId: string,
  api: PrintApi = issuanceApi,
): Promise<LoadPrintResult> {
  const issuance = await api.getIssuance(issuanceId)
  if (!issuance)
    return {
      ok: false,
      message: "This issuance could not be found, so it cannot be printed.",
    }
  if (issuance.status === "voided")
    return {
      ok: false,
      message: `${issuance.referenceNo} was voided and cannot be printed.`,
    }

  const lookups = await api.getLookups()
  const name = await api.getResidentName(issuance.residentId)
  const details = issuance.payload.details
  const tricycle =
    details.type === "FRANCHISE_CLEARANCE"
      ? await api.getTricycle(details.tricycleId)
      : undefined
  const printLookups: PrintLookups = {
    sectors: lookups.sectors,
    idTypes: lookups.idTypes,
    purposes: lookups.purposes,
    tricycle: tricycle
      ? {
          association: tricycle.associationName,
          make: tricycle.make,
          bodyType: tricycle.bodyType,
          motorNumber: tricycle.motorNumber,
          color: tricycle.color,
          plateNumber: tricycle.plateNumber,
        }
      : undefined,
  }
  const data = buildPrintData(issuance, printLookups, name)
  if (!data)
    return {
      ok: false,
      message:
        "This document type has no print template yet, so it cannot be printed from here.",
    }
  if (printTemplates[data.templateId].photo && api.loadResidentPhoto) {
    data.photoUrl = await api.loadResidentPhoto(issuance.residentId)
  }
  return { ok: true, data }
}
