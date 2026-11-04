# Document templates (reference only)

Word copies of the barangay's document forms are references for the typed-value overlay (see [04-Documents-and-Printing.md](../../04-Documents-and-Printing.md)). The system does not read these files. It prints typed values only, onto matching pre-printed paper.

| File | Print template | Photo box |
|---|---|---|
| `Barangay_Clearance.docx` | Yes — `clearance` | Yes (resident photo; thumbmark area stays blank) |
| `Barangay_Clearance_Electrical_and_Water.docx` | Yes — `utility` | No |
| `Barangay_Franchise_Clearance.docx` | Yes — `franchise` | No |
| `Barangay_Certification_of_Indigency.docx` | Yes — `indigency` | No |
| `Barangay_Certification_of_Marginalized_Sector.docx` | Yes — `marginalized` on page 1 and `assistance` on page 2 | No |
| `Barangay_Certification_of_Residency.docx` | No | Not applicable |
| `First-Time_Jobseekers.docx` | No | Not applicable |

## Privacy and printing rules

- **Privacy warning:** `Barangay_Certification_of_Residency.docx` contains real names and violates the repository's synthetic-data-only rule. It is flagged here for remediation, but has intentionally **not** been edited or deleted as instructed. Do not use it in screenshots, demos, print comparisons or sample data. Ask the repository owner/client to provide a scrubbed blank copy before using it as a reference.
- Use synthetic data only. Never commit real names, ID numbers, resident photos, signature images or filled-in forms.
- The system prints typed values only. Do not print labels, logos, watermarks, fixed paragraphs, signatures, dry-seal labels or footers. Keep thumbmark and resident-signature areas blank.
- The files are reference documents. The print overlay does not parse or import their contents.
- The Barangay ID layout (`.pub`) is not listed as a Word file and has no print template. ID front and back remain unsupported.
