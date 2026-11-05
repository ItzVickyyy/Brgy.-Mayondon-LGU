/**
 * Loads everything buildPrintData needs for one stored issuance (see docs/04-Documents-and-Printing.md section 6).
 * Talks to the (mock) issuance API, so it is async. The pure mapping stays in buildPrintData.ts.
 */
import { issuanceApi } from "@/components/Issuances/NewIssuance/issuanceApi"
import {
  buildPrintData,
  type PrintData,
  type PrintLookups,
} from "./buildPrintData"

export type LoadPrintResult =
  | { ok: true; data: PrintData }
  | { ok: false; message: string }

export async function loadPrintData(
  issuanceId: string,
): Promise<LoadPrintResult> {
  const issuance = await issuanceApi.getIssuance(issuanceId)
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

  const lookups = await issuanceApi.getLookups()
  const resident = issuanceApi.getResident(issuance.residentId)
  const details = issuance.payload.details
  const tricycle =
    details.type === "FRANCHISE_CLEARANCE"
      ? await issuanceApi.getTricycle(details.tricycleId)
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
  const name = resident
    ? {
        firstName: resident.firstName,
        middleName: resident.middleName,
        lastName: resident.lastName,
        suffix: resident.suffix,
      }
    : undefined
  const data = buildPrintData(issuance, printLookups, name)
  if (!data)
    return {
      ok: false,
      message:
        "This document type has no print template yet, so it cannot be printed from here.",
    }
  return { ok: true, data }
}
