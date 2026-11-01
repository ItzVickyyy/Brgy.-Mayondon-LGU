# Roles and Access Plan

**Project:** Barangay Mayondon Records and Document Issuance System  
**Status:** Proposed access plan for team review and client confirmation  
**Last updated:** November 1, 2026

This is a proposal for the prototype. It is not a client-approved permissions policy. The current Creative Brief says that six staff accounts will have full access. The proposed Staff/System Administrator split below changes that assumption, so confirm it with the barangay before treating it as a requirement or deploying it with real data.

## Proposed roles

- **Staff:** Performs routine resident-record and document-issuance work. Staff can view and update the records needed for their duties and view their own activity.
- **System Administrator:** Performs routine work and manages user accounts, access, system configuration, reporting, backup/restore, and administrative review.

The current API user model exposes `is_superuser`. The prototype's role selector maps **System Administrator** to `is_superuser = true` and **Staff** to `is_superuser = false`. This is a UI/API mapping, not a separate role enum or a complete permission system.

## Proposed access matrix

| Module / action | Staff | System Administrator |
|---|---|---|
| Dashboard | Operational cards and own recent activity | Same, plus system-wide activity |
| Resident Records: search, view, add, edit | Allowed | Allowed |
| Resident Records: import masterlist | To confirm with client; proposed restricted | Allowed |
| Resident Records: archive | No | Allowed |
| Issuance Management: create, review, print, correct with reason | Allowed | Allowed |
| Issuance Management: void/cancel | No | Allowed |
| Barangay IDs: list, create, renew, print | Allowed | Allowed |
| Barangay IDs: override validity rules | No | Allowed |
| Activity Log | Own activity | All users, with filters |
| My Account and User Settings | Allowed | Allowed |
| System Settings: barangay information, templates, purpose list | No | Allowed |
| Officials | No | Allowed |
| User Accounts | No | Allowed |
| Pending Registrations | No | Allowed |
| Management Reports | No | Allowed |
| Backup and Restore | No; manual backup permission remains to be confirmed | Allowed |

## Account approval and status

The prototype may show sample pending/approved/rejected requests for design review. Do not represent those sample decisions as saved account requests or real approvals.

If account approval becomes a real feature, the backend and database need an explicit, reviewed status field and server-side rules. Suggested statuses are `pending`, `active`, `rejected`, and `inactive`. These are proposed values, not existing verified backend fields. The current API's `is_active` boolean does not by itself represent pending and rejected states. Do not implement approval by relying only on a frontend label or local component state.

## Questions for the barangay

1. Who should be the System Administrator, and who is authorized to approve or disable accounts?
2. May Staff import or replace a resident masterlist?
3. May Staff trigger manual backups, or should backup/restore be restricted to the System Administrator?
4. Does the client still require all six staff accounts to have full access, as written in the Creative Brief, or does the client approve role-based restrictions?
5. Which actions must require a reason and be recorded in an audit history?

## Security and privacy requirements to verify

- Enforce every role and record permission on the backend for each protected API operation. Hiding a route or button in the frontend is not security enforcement.
- Protect role changes, account status, approval decisions, record ownership, and other privileged fields from unauthorized updates.
- Keep audit history append-only for users who must not be allowed to edit or delete it. Record who performed sensitive actions and when.
- Do not place passwords, access tokens, or unnecessary resident personal information in logs.
- Confirm the purpose, minimum required resident data, permitted access, retention, correction, disclosure, backup custody, and incident process with the client, consistent with the Philippine Data Privacy Act of 2012.
- Use synthetic sample data in development, screenshots, and demonstrations. Do not claim legal approval, privacy compliance certification, or client approval without documented evidence.

## Implementation boundary

This plan documents a proposed UI access model. It does not establish that backend authorization, account approval persistence, audit logging, or production security controls have been implemented. Verify those separately before any real deployment.
