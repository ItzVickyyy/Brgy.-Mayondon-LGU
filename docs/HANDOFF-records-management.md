# Records Management (Resident Records + Barangay IDs merged)

Status: done in three rounds (A: merge, B: issuance links, C: cleanup). Synthetic data only.

## What exists
- `/records` is "Records Management" with tabs: Residents, Barangay IDs, Family & Sector Details, Import Masterlist (admin only).
- `?view=barangay-ids` opens the ID tab. `/barangay-ids` is only a redirect to it (`routes/_layout/barangay-ids.tsx`).
- The ID tab is `components/Records/BarangayIdsView.tsx`. The Residents table shows only an ID status badge.
- No "Create Barangay ID" button: IDs are issued from Issuance Management.
- ID rows: Print and Renew open `/issuances?resident=<residentId>&type=BARANGAY_ID`. New Issuance reads both values (`initialResidentId`, `initialDocumentType`), selects the resident and document type once per open, and the page removes the two query values when the dialog closes.

## Open items
- "Print" on an ID row starts a new Barangay ID issuance. There is no ID card layout file in the repo, so a true reprint is not possible yet.
- ID records (`BarangayIdsView`), residents (`records-sample-data`) and the issuance store (`issuanceApi`) are separate in-memory samples. When real data exists they must share resident ids or the preselection will not find the resident.
- Still to decide with the client: the barangay's current ID numbering series and how the next number is assigned, and the approved ID layout (photo placement, print scaling, card size).
- The Welcome page and the Activity Log module filter still use the old names "Resident Records" and "Barangay IDs".
