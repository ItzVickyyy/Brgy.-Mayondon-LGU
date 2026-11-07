import { z } from "zod"
import type { DocumentCode } from "./documentConfig"

const nonEmpty = z.string().trim().min(1, "This field is required.")
/** Set by the form once the officials are loaded: a signatory is only required when one exists. */
export const signatoryRules = { available: false }
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid ISO date (YYYY-MM-DD).")
const identificationSchema = z.object({
  idTypeId: z.number().int().positive(),
  idNumber: nonEmpty,
  placeOfIssue: nonEmpty,
  dateOfIssue: isoDate,
})
const paymentSchema = z.object({
  officialReceiptNo: z.string().trim().optional(),
  isFree: z.boolean(),
  dateOfPayment: isoDate.optional(),
  certifiedBy: z.string().trim().optional(),
}).superRefine((value, context) => {
  if (!value.isFree && !value.officialReceiptNo) {
    context.addIssue({ code: "custom", path: ["officialReceiptNo"], message: "Official receipt number is required unless free of charge." })
  }
})

const detailsSchemas = {
  BARANGAY_CLEARANCE: z.object({ type: z.literal("BARANGAY_CLEARANCE") }),
  FRANCHISE_CLEARANCE: z.object({ type: z.literal("FRANCHISE_CLEARANCE"), associationName: nonEmpty, make: nonEmpty, bodyType: nonEmpty, motorNumber: nonEmpty, color: nonEmpty, plateNumber: nonEmpty }),
  UTILITY_CLEARANCE: z.object({ type: z.literal("UTILITY_CLEARANCE"), services: z.array(z.enum(["electric", "water"])).min(1), connectionType: z.enum(["new", "reconnection"]), classification: z.enum(["residential", "commercial"]), location: nonEmpty }),
  RESIDENCY: z.object({ type: z.literal("RESIDENCY") }),
  INDIGENCY: z.object({ type: z.literal("INDIGENCY"), addressedToOffice: nonEmpty, requestedBy: z.string().optional() }),
  ASSISTANCE: z.object({ type: z.literal("ASSISTANCE"), assistanceType: z.enum(["financial", "medical", "burial"]), forSelf: z.boolean(), beneficiaryName: z.string().optional(), beneficiaryRelationship: z.string().optional() }),
  MARGINALIZED_SECTOR: z.object({ type: z.literal("MARGINALIZED_SECTOR"), healthCondition: nonEmpty }),
  FIRST_TIME_JOBSEEKER: z.object({ type: z.literal("FIRST_TIME_JOBSEEKER"), educationalAttainment: nonEmpty, course: nonEmpty, isJobstartBeneficiary: z.boolean(), witnessOfficialId: nonEmpty, parts: z.array(z.enum(["applicant_sheet", "oath", "certification"])).min(1) }),
  BARANGAY_ID: z.object({ type: z.literal("BARANGAY_ID"), transactionType: z.enum(["new", "renewal", "replacement"]), validUntil: isoDate, idNumber: z.string().trim().optional() }),
}

export const documentDetailsSchema = z.discriminatedUnion("type", [
  detailsSchemas.BARANGAY_CLEARANCE,
  detailsSchemas.FRANCHISE_CLEARANCE,
  detailsSchemas.UTILITY_CLEARANCE,
  detailsSchemas.RESIDENCY,
  detailsSchemas.INDIGENCY,
  detailsSchemas.ASSISTANCE,
  detailsSchemas.MARGINALIZED_SECTOR,
  detailsSchemas.FIRST_TIME_JOBSEEKER,
  detailsSchemas.BARANGAY_ID,
]).superRefine((value, context) => {
  if (value.type === "ASSISTANCE" && !value.forSelf) {
    if (!value.beneficiaryName?.trim()) context.addIssue({ code: "custom", path: ["beneficiaryName"], message: "Name is required when assistance is for someone else." })
    if (!value.beneficiaryRelationship?.trim()) context.addIssue({ code: "custom", path: ["beneficiaryRelationship"], message: "Relationship is required when assistance is for someone else." })
  }
})

export type DocumentDetails = z.infer<typeof documentDetailsSchema>
export type DocumentDetailsByCode = { [K in DocumentCode]: Extract<DocumentDetails, { type: K }> }

const baseIssuanceSchema = z.object({
  documentType: z.enum([
    "BARANGAY_CLEARANCE", "FRANCHISE_CLEARANCE", "UTILITY_CLEARANCE", "RESIDENCY", "INDIGENCY",
    "ASSISTANCE", "MARGINALIZED_SECTOR", "FIRST_TIME_JOBSEEKER", "BARANGAY_ID",
  ]),
  issueDate: isoDate,
  residentId: nonEmpty,
  residentUpdates: z.record(z.string(), z.unknown()).optional(),
  purposeId: z.number().int().positive().optional(),
  purposeText: z.string().trim().optional(),
  remarks: z.string().optional(),
  signatoryOfficialId: z.string().optional(),
  identification: identificationSchema.optional(),
  payment: paymentSchema.optional(),
  sectors: z.array(z.object({ sectorId: z.number().int().positive(), idNumber: z.string().optional() })).optional(),
  details: documentDetailsSchema,
  status: z.enum(["draft", "issued"]),
}).superRefine((value, context) => {
  if (value.documentType !== value.details.type) {
    context.addIssue({ code: "custom", path: ["details", "type"], message: "Details must match the selected document type." })
  }
  if (value.status === "issued") {
    if (["BARANGAY_CLEARANCE", "RESIDENCY", "INDIGENCY"].includes(value.documentType) && !value.purposeText?.trim()) {
      context.addIssue({ code: "custom", path: ["purposeText"], message: "Purpose is required." })
    }
    if (["INDIGENCY", "ASSISTANCE", "MARGINALIZED_SECTOR"].includes(value.documentType) && !value.sectors?.length) {
      context.addIssue({ code: "custom", path: ["sectors"], message: "Choose a sector." })
    }
    if (value.documentType === "INDIGENCY" && (value.sectors?.length ?? 0) > 2) {
      context.addIssue({ code: "custom", path: ["sectors"], message: "Choose no more than two sectors." })
    }
    if (["ASSISTANCE", "MARGINALIZED_SECTOR"].includes(value.documentType) && (value.sectors?.length ?? 0) !== 1) {
      context.addIssue({ code: "custom", path: ["sectors"], message: "Choose exactly one sector." })
    }
    if (signatoryRules.available && ["RESIDENCY", "ASSISTANCE", "MARGINALIZED_SECTOR", "FIRST_TIME_JOBSEEKER"].includes(value.documentType) && !value.signatoryOfficialId) {
      context.addIssue({ code: "custom", path: ["signatoryOfficialId"], message: "Choose a signatory." })
    }
    const codeNeedsIdentity: DocumentCode[] = ["BARANGAY_CLEARANCE", "FRANCHISE_CLEARANCE", "UTILITY_CLEARANCE"]
    if (codeNeedsIdentity.includes(value.documentType as DocumentCode) && !value.identification) {
      context.addIssue({ code: "custom", path: ["identification"], message: "Proof of identity is required." })
    }
    if (["BARANGAY_CLEARANCE", "FRANCHISE_CLEARANCE", "UTILITY_CLEARANCE"].includes(value.documentType) && !value.payment) {
      context.addIssue({ code: "custom", path: ["payment"], message: "Payment details are required." })
    }
  }
})

export const issuanceInputSchema = baseIssuanceSchema
export type IssuanceInput = z.infer<typeof issuanceInputSchema>

export const documentDetailSchemas = detailsSchemas
