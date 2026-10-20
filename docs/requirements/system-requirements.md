# System Requirements: Initial Draft

**Project:** Barangay Mayondon Record Management System  
**Status:** Initial draft based on interviews on October 19 and 20, 2026. Professor and client review pending.

This document translates interview findings into candidate system requirements. It distinguishes interview-supported needs from details that still require confirmation. The signed Creative Brief and subsequent client decisions take precedence.

## 1. Confirmed project direction

The team is planning a staff-facing record management system for Barangay Mayondon. The client wants to make resident lookup and document preparation easier, retain a history of previous issuances, preserve existing clearance formats, and simplify Barangay ID preparation. The client prefers offline operation because internet connectivity is slow.

The current Creative Brief records that the office has no dedicated server and that staff reported its computers are connected through a local network. The team must verify the actual setup before selecting the final deployment architecture.

## 2. Candidate functional requirements

| ID | Requirement | Basis | Status |
|---|---|---|---|
| FR-01 | Authorized staff can sign in to the system. | Staff-facing system described in the Creative Brief. | Proposed; account and permission details need confirmation. |
| FR-02 | Staff can search for and retrieve existing resident records. | Discussed in both interviews. | Supported; exact search fields need confirmation. |
| FR-03 | Staff can maintain resident records and relevant related information used by the current workflow. | Existing resident and related masterlists. | Scope supported; exact fields and data migration need confirmation. |
| FR-04 | Staff can access resident and Barangay ID number records. | October 20 discussion and provided-materials list. | Supported; official numbering rules need confirmation. |
| FR-05 | Staff can prepare and print selected client-approved documents using the existing clearance formats. | October 20 interview. | Supported; exact document list, fields, and template details need approval. |
| FR-06 | The system can keep a separate history of document requests and issuances instead of overwriting earlier transactions. | Both interviews. | Supported; required history fields and correction rules need confirmation. |
| FR-07 | The system can support Barangay ID preparation and printing with a simpler layout, subject to client approval. | October 20 interview. | Supported as a direction; layout and printing rules need approval. |
| FR-08 | The system provides a suitable local backup and restore procedure. | October 19 interview and Creative Brief objective. | Required direction; method and responsible staff need confirmation. |

## 3. Candidate document priorities

Based on the October 20 interview, prioritize confirmation of these document types:

- Barangay Clearance
- Postal ID Clearance
- Certificate of Indigency
- Damayan Certificate
- Barangay ID

Other sample documents appear in the materials inventory. Their inclusion in the final implemented scope must be confirmed with the client and reflected in the approved Creative Brief. Do not assume every file supplied by the client must become a system module.

## 4. Non-functional requirements and constraints

- **Offline use:** Prefer local operation because the client reports slow internet.
- **Local network:** Confirm the office's actual network topology, devices, and printer before deciding between single-computer and LAN deployment.
- **Usability:** Keep navigation simple, labels readable, and document preparation efficient for staff with different levels of computer experience.
- **Document fidelity:** Retain existing clearance formats unless the client approves a change. A simpler Barangay ID layout may be proposed for approval.
- **Privacy and security:** Limit access to authorized staff, protect resident information, avoid unnecessary copies, and use fictional test data where possible.
- **Data integrity:** Avoid overwriting prior issuance history. Establish safe backup, restoration, and correction procedures.
- **Printing:** Test paper size, alignment, and output with the office printer before handover.

## 5. Explicitly out of scope

- Blotter and Incident Records System. Ma'am Marga mentioned this as a recommendation for another group, not a feature for this team.
- Public online self-service access, online payments, and public announcements, as stated in the current Creative Brief.
- Generating, imitating, or applying officials' signatures or barangay dry seals. The system may prepare documents for review and authorized wet signature/sealing according to the office's process.

## 6. Open questions for client confirmation

1. What exact fields are required for each selected document, and which fields are mandatory?
2. Which document types are actively processed by the barangay and should be included in the first version?
3. What fields should an issuance-history entry retain, such as document type, date, reference number, staff member, purpose, or validity?
4. What is the official Barangay ID numbering scheme, and how are resident eligibility and validity determined?
5. What should happen when resident details are corrected, a duplicate record is found, or an old record is marked inactive?
6. Which staff members need accounts, and what tasks should each account be permitted to perform?
7. Which computers and printers are available, and how are they connected on the local network?
8. How should backups be stored, who may restore them, and how often should backups be made?
9. Which client-provided files have been received and approved for use, and what is the approved process for accessing them securely?
10. Does the client approve the proposed simpler Barangay ID layout after reviewing a mockup?

## 7. Next steps

- Have the professor review the Creative Brief draft.
- Confirm open questions with the client before finalizing the sitemap and wireframes.
- Use only approved blank templates and fictional records during design and testing.
- Update this document when requirements are confirmed or changed.
