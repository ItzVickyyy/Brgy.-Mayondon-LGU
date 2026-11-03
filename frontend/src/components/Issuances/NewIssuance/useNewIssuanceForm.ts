import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { issuanceInputSchema, type IssuanceInput, type DocumentDetails } from "./schemas"
import type { DocumentCode } from "./documentConfig"

export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function defaultDetails(code: DocumentCode): DocumentDetails {
  switch (code) {
    case "BARANGAY_CLEARANCE":
      return { type: code }
    case "FRANCHISE_CLEARANCE":
      return { type: code, associationName: "", make: "", bodyType: "TRICYCLE", motorNumber: "", color: "", plateNumber: "" }
    case "UTILITY_CLEARANCE":
      return { type: code, services: [], connectionType: "new", classification: "residential", location: "Barangay Mayondon" }
    case "BUILDING_CLEARANCE":
      return { type: code, location: "Barangay Mayondon" }
    case "RESIDENCY":
      return { type: code }
    case "INDIGENCY":
      return { type: code, addressedToOffice: "" }
    case "PHILHEALTH_CERT":
      return { type: code, cardType: "BLUE CARD" }
    case "ASSISTANCE":
      return { type: code, assistanceType: "financial", forSelf: true }
    case "MARGINALIZED_SECTOR":
      return { type: code, healthCondition: "" }
    case "FIRST_TIME_JOBSEEKER":
      return { type: code, educationalAttainment: "", course: "N/A", isJobstartBeneficiary: false, witnessOfficialId: "", parts: ["applicant_sheet", "oath", "certification"] }
    case "BARANGAY_ID": {
      const validUntil = new Date()
      validUntil.setFullYear(validUntil.getFullYear() + 1)
      return { type: code, transactionType: "new", validUntil: localIsoDate(validUntil) }
    }
  }
}

export function defaultIssuanceInput(residentId = ""): IssuanceInput {
  return {
    documentType: "BARANGAY_CLEARANCE",
    issueDate: localIsoDate(),
    residentId,
    purposeText: "",
    remarks: "NO DEROGATORY RECORD ON FILE",
    identification: { idTypeId: 0, idNumber: "", placeOfIssue: "Los Baños, Laguna", dateOfIssue: localIsoDate() },
    payment: { officialReceiptNo: "", isFree: false, dateOfPayment: localIsoDate(), certifiedBy: "" },
    details: defaultDetails("BARANGAY_CLEARANCE"),
    status: "draft",
  }
}

export function useNewIssuanceForm(residentId = "") {
  return useForm<IssuanceInput>({
    resolver: zodResolver(issuanceInputSchema),
    defaultValues: defaultIssuanceInput(residentId),
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
}
