# Creative Brief

**Project:** Barangay Mayondon Records and Document Issuance System  
**Client:** Barangay Mayondon Local Government Unit, Los Baños, Laguna  
**Interview dates:** October 19 and 20, 2026  
**Status:** Updated on October 27, 2026, to reflect the revised Creative Brief reviewed by the professor. Use this as the approved planning baseline. The uploaded copy's client and group leader signature fields appear blank, so verify and retain the signed copy separately if signatures are required.

## 1. Project title

Barangay Mayondon Records and Document Issuance System

## 2. Client profile

- **Office:** Barangay Mayondon Local Government Unit
- **Address:** Barangay Mayondon, Los Baños, Laguna
- **Interview contacts:** Ma’am Margarita R. Rivera, Admin Assistant; Sir Kelly Renz G. Villegas, Barangay Clerk
- **Office function relevant to this project:** Maintaining resident-related records and preparing and issuing barangay documents and Barangay IDs.
- **Users:** Authorized barangay office personnel. Residents are the subjects of stored records and the people requesting documents. Public access has not been requested.

## 3. Background and problem

Based on interviews on October 19 and 20, 2026, staff use Google Sheets, Excel, and document templates to manage resident records, ID details, and document requests. Reusing templates requires repeated data entry and makes previous issuances difficult to track. Staff also reported spreadsheet errors, saving issues, and missing files.

Staff want a system where they can find existing resident records, enter document-request details, fill approved document formats, and print without repeatedly retyping the same information. For clearances, staff currently enter the resident and transaction details in an Excel workbook. Each worksheet corresponds to a different form, and the workbook prints only the entered details onto a blank pre-printed form. The pre-printed paper already contains the official header, labels, signature area, and space for the dry seal. The system should follow this workflow: staff enter the required details once, then print those details in the matching positions on the same approved blank form. Print placement must be calibrated and tested so the text lines up accurately with the pre-printed fields. Barangay ID preparation currently uses Excel and Publisher, including manual print-size adjustments. The office reported slow internet, prefers an offline system, has no dedicated server, and has computers connected through a local network.

## 4. Project objectives

1. Centralize resident records and related information in a structured system.
2. Let authorized staff search and retrieve existing resident and Barangay ID records.
3. Keep a separate history of document requests and issuances, including issue and expiry dates, rather than overwriting previous transactions.
4. Reduce repeated data entry and make preparation and printing of approved documents and Barangay IDs easier.
5. Provide a suitable local data backup and recovery procedure.

## 5. Target users

The primary users are six clerical staff members, two female and four male, who handle resident records, document preparation, and issuance, including the night-duty staff member. Their ages are estimated at around 30 to 60 years old. The interface should be simple, easy to navigate, and readable for staff with different levels of computer experience, including senior staff.

## 6. Scope and limitations

### Included in the current draft scope

- Staff login for six accounts, all with full access as specified in the revised Creative Brief.
- Dashboard showing documents issued and clearances or IDs nearing expiry.
- Resident record management, search, and import of existing masterlist data.
- Family, beneficiary, and marginalized-sector details where required by the current office workflow.
- Resident and Barangay ID number records.
- Document request entry with an editable list of purposes.
- Issuance history and expiry dates.
- Auto-filled printing of approved documents and Barangay IDs, including ID photo upload.
- Local data backup and restore.

### Excluded from the current draft scope

- Public-facing resident accounts, online announcements, and website content.
- Online payments and fee collection.
- Blotter, incident, and tanod records. These were discussed separately and are outside the clerical-document system prioritized in the interviews.
- Business and building clearances handled by the municipality.
- Documents issued by other agencies, such as BIR and PhilHealth. The barangay's own Certificate of Indigency remains in scope.
- Creating, imitating, or applying official signatures or dry seals. These remain manual.
- Cloud hosting, online data synchronization, and other internet-dependent services.
- Purchase of hardware, network equipment, or internet service.

The scope is based on interview notes and the current Creative Brief draft. Confirm the final inclusion and exclusion list with the client before coding.

## 7. Main features

1. **Login:** Six staff accounts, all with full access.
2. **Dashboard:** Overview of issued documents and clearances or IDs nearing expiry.
3. **Resident Records:** Add, edit, search, and import existing masterlist data.
4. **Family and Sector Details:** Store family, beneficiary, and sector details where the client's workflow requires them.
5. **ID Records:** Preserve existing Barangay ID numbering. The client described one-year validity in the usual case and six-month validity for new or renting residents until proof of voter registration is provided. The client also maintains a separate list of newer residents dating from 2019 with registered/unregistered remarks.
6. **Document Requests:** Record requests, select or maintain document purposes, and preserve issuance history.
7. **Document and ID Printing:** Populate approved document layouts and Barangay IDs, including an ID photo where required. For documents issued on pre-printed paper, print only the variable details into the corresponding spaces on the existing blank form. Match the current Excel workbook workflow, where each worksheet corresponds to a different form. Calibrate print position, scaling, paper size, margins, and printer settings against the actual forms, then test printed samples before client acceptance. Do not recreate or print the pre-printed header, labels, signature, or dry-seal area unless the client explicitly approves a different layout. Official signatures and dry seals remain manual.
8. **Backup and Restore:** Support scheduled and manual local backups saved to an external drive. Agree on the schedule, drive custody, restore procedure, and responsibilities, then test backup and recovery.

Document types discussed or shown include Barangay Clearance, Franchise Clearance, Certificate of Indigency, clearance for electrical and water connection, residency-related documents, First-Time Jobseeker documents, and Barangay ID. Confirm the final list and the exact approved formats with the client. Do not add documents merely because a sample exists.

## 8. Platform

- **Preferred operation:** Fully offline, on the barangay office's local network, without requiring internet access for normal system use.
- **Devices:** Existing barangay office computers and printers.
- **Proposed installation:** One designated office computer runs the system; other office computers access it over the local network. The designated computer must remain on during service hours.
- **Backup destination:** External drive, subject to an agreed backup and restore procedure.
- **Technical direction:** Use a locally hosted application and database accessible over the office LAN, without internet access during normal operation. The repository's current Docker-based local-host path is preparation only. The actual offline workflows, LAN access, backup and restore, startup behavior, and client-site deployment still require testing.

## 9. Look and feel

- **Direction:** Simple, formal, modern, and quick to navigate.
- **Colors:** Neutral palette. Navy blue, white, and light gray are suggested based on the barangay logo; confirm the final palette with the client.
- **Logo:** Barangay Mayondon official logo, supplied by the client.
- **Typography:** Clean, readable sans-serif fonts such as Arial.
- **Usability:** Clear labels, readable text, straightforward navigation, and efficient workflows for office staff, including senior users.
- **Reference websites:** None specified by the client.

## 10. Content to be provided

| Content | Reported date received |
|---|---|
| Hard copies of Barangay Clearance, Franchise Clearance, Certificate of Indigency, and clearance for electrical and water connection | October 19, 2026 |
| Current clearance-issuing Excel sheet | October 19, 2026 |
| Barangay Mayondon logo and Barangay ID layout in Publisher format | October 20, 2026 |
| Resident and ID data, including ID Number Masterlist, ID System-Mayondon, and marginalized-sector sheets | October 20, 2026 |
| Residency and First-Time Jobseeker documents | October 20, 2026 |
| Other document samples | To be confirmed |

Treat resident records and identification data as confidential. Do not commit real resident data to Git or use it in public demos. Confirm authorization, access, retention, backup, and handling procedures with the client in line with the Data Privacy Act of 2012.

## 11. Timeline

The dates below are the timeline in the professor-reviewed Creative Brief. The ITST301 Final Project Guide remains the source for academic submission milestones and takes precedence if dates conflict.

| Milestone | Working date |
|---|---|
| Client interviews | October 19–20, 2026 |
| Information architecture approval | October 27, 2026 |
| Design phase | October 26–31, 2026 |
| Development phase | November 1–8, 2026 |
| Testing | November 9–13, 2026 |
| Presentation | November 16 or 19, 2026 |


## 12. Approval

This version reflects the Creative Brief reviewed by the professor and is the current planning baseline. The approval table in the supplied copy has blank signature fields. Confirm whether client and group leader signatures have been obtained and keep the signed copy for the required documentation.

| Client representative | Group leader |
|---|---|
| Signature over printed name: ____________________ | Signature over printed name: ____________________ |
| Date: ____________________ | Date: ____________________ |

## Open confirmations before design and implementation

- Confirm the final feature list, document types, and approved print layouts. Obtain the current Excel workbook and clean blank copies of each form, map each worksheet to its matching form, confirm paper size and printer settings, and approve the printed alignment with the client.
- Configure the six staff accounts with full access, as specified in the revised Creative Brief. Confirm the safe account setup and recovery procedure before deployment.
- Confirm whether the proposed one-computer local host and LAN access is acceptable and identify the designated computer.
- Confirm how photos will be processed if background removal currently depends on an online service. No internet-dependent photo service can be assumed available in a fully offline system.
- Confirm how resident masterlists will be imported, how duplicate or outdated records will be handled, and which data fields are actually needed.
- Confirm ID-number rules, validity exceptions, and how voter-registration proof is recorded.
- Agree on the scheduled and manual backup frequency, external-drive custody, restoration responsibilities, and data-retention procedures.
- Confirm which sample documents are still in use. Business and building clearances described as municipal processes should remain excluded unless the client corrects that understanding.
- Confirm whether the client and group leader signature fields have been completed on the approved copy, and store the signed version for the final report.
