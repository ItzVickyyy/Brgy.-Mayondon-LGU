# Style Guide

**Project:** Barangay Mayondon Records and Document Issuance System  
**Status:** Working frontend reference for group review. Client approval is still required.  
**Last updated:** November 1, 2026

## Visual direction

Use a calm, formal, office-focused interface. Keep the existing navy-leaning primary color, white/light-gray surfaces, clear page headings, consistent borders, and responsive cards and tables. The exact brand palette must be confirmed with the barangay.

## Current theme palette

The global stylesheet defines these colors with OKLCH tokens. The hexadecimal values below are rounded 8-bit sRGB equivalents calculated from the current tokens. The source CSS remains authoritative for actual rendering.

| Token | Light theme | Dark theme | Intended use |
|---|---|---|---|
| Background | `#FFFFFF` | `#0A0A0A` | Main page surface |
| Foreground | `#0A0A0A` | `#FAFAFA` | Main text |
| Card | `#FFFFFF` | `#343434` | Cards and panels |
| Primary | `#0C2F52` | `#1D3F63` | Primary actions and key accents |
| Primary foreground | `#FAFAFA` | `#FAFAFA` | Text/icons on primary surfaces |
| Secondary / muted | `#F5F5F5` | `#262626` | Secondary controls and quiet surfaces |
| Muted foreground | `#737373` | `#A1A1A1` | Supporting text |
| Border / input | `#E5E5E5` | Alpha-white border/input tokens | Separators and form controls |
| Destructive | `#E7000B` | `#FF6467` | Destructive actions and errors |
| Focus ring | `#A1A1A1` | `#737373` | Keyboard focus indicator |
| Sidebar | `#FAFAFA` | `#343434` | Navigation surface |

The base radius token is `0.625rem`. Theme variants and utility names are mapped through the existing Tailwind CSS theme configuration in `index.css`. These values describe the current implementation, not client-approved brand specifications.

## Typography and spacing

- The inspected global stylesheet does not define a custom font family. Keep the current application/framework default until the team confirms a font from the design mockups.
- Page headings use the current utility pattern `text-2xl font-bold tracking-tight sm:text-3xl`.
- Body text should remain readable. Use at least 16px for form/table content where practical; supporting labels can be smaller only when still legible.
- Use the existing Tailwind spacing scale and recurring card padding patterns such as `p-4` and `sm:p-5`. Do not introduce arbitrary spacing values without a layout need.
- Existing icon sizes commonly use `size-4` for 16px, `size-5` for 20px, and `size-6` for 24px. Keep matching actions consistent.
- Preserve responsive grid behavior: single-column on narrow screens, then expand at existing breakpoints.

## Components and interaction

- Use existing shadcn/ui components when available for buttons, dialogs, inputs, badges, tables, and form controls.
- Keep visible labels for inputs and accessible names for icon-only controls.
- Aim for 44px minimum height for primary touch controls and form inputs.
- Provide visible keyboard focus styles with the existing ring tokens.
- Use confirmation before archive, void/cancel, reject, or restore actions.
- Use status text as well as color so status is not conveyed by color alone.
- Wrap wide tables in horizontal scrolling containers or use a mobile-friendly card layout.
- Use explicit “Sample Data” badges on the dashboard's fictional summary cards, charts, and sample lists. Do not label every page indiscriminately. Never present sample values as real barangay statistics.

## Assets and decisions to confirm

- Official logo path in the app configuration: `/assets/images/Barangay%20Mayondon%20Logo.png`.
- Proposed palette direction: navy blue, white, and light gray, based on the current tokens and the logo direction in the design draft.
- Confirm exact brand colors, typography, print styling, status colors, and any required logo clear-space rules with the client.
- Do not change global tokens unless the team identifies a real contrast or consistency issue and reviews the effect across light/dark themes.
- Verify WCAG AA contrast for actual rendered text and controls before presenting the design as accessibility-checked. Token names alone are not proof of contrast compliance.
