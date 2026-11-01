# Style Guide

**Project:** Barangay Mayondon Records and Document Issuance System  
**Status:** Working frontend reference for group review. Client approval is still required.  
**Last updated:** November 1, 2026

## Visual direction

Use a calm, formal, office-focused interface. Keep the existing navy-leaning primary color, white/light-gray surfaces, clear page headings, consistent borders, and responsive cards and tables. The exact brand palette must be confirmed with the barangay.

## Current theme tokens

Values below are copied from `frontend/src/index.css`. The stylesheet defines colors in OKLCH, not hexadecimal notation. No hex equivalents are declared in the source, so this guide does not invent hex values.

| Token | Light theme | Dark theme | Intended use |
|---|---|---|---|
| Background | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Main page surface |
| Foreground | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Main text |
| Card | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Cards and panels |
| Primary | `oklch(0.30 0.075 252)` | `oklch(0.36 0.075 252)` | Primary actions and key accents |
| Primary foreground | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | Text/icons on primary surfaces |
| Secondary / muted | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary controls and quiet surfaces |
| Muted foreground | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Supporting text |
| Border / input | `oklch(0.922 0 0)` | Border `oklch(1 0 0 / 10%)`, input `oklch(1 0 0 / 15%)` | Separators and form controls |
| Destructive | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Destructive actions and errors |
| Focus ring | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Keyboard focus indicator |

The base radius token is `0.625rem`. Theme variants and utility names are mapped through the existing Tailwind CSS theme configuration in `index.css`.

## Typography and spacing

- The inspected global stylesheet does not define a custom font family. Keep the current application/framework default until the team confirms a font from the design mockups.
- Page headings use the current utility pattern `text-2xl font-bold tracking-tight sm:text-3xl`.
- Body text should remain readable. Use at least 16px for form/table content where practical; supporting labels can be smaller only when still legible.
- Use the existing Tailwind spacing scale and recurring card padding patterns such as `p-4` and `sm:p-5`. Do not introduce arbitrary spacing values without a layout need.
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
