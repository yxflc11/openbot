# Research: PDF.js 6.3 dependency graph coherence

- Status: Accepted for implementation; platform CI remains a merge gate
- Date: 2026-09-12
- Owner: @yxflc11
- Related issue: #50
- Acceptance journey: A clean npm 10.9.9 install resolves one reviewed PDF parser for direct and Office extraction; encrypted and scripted PDF fixtures retain their existing behavior.
- Security boundary: Server-owned byte-only parser Worker, bounded input/output/time, no viewer or PDF scripting manager, transient passwords and digest-bound derived text.

## Search evidence

Reviewed the existing attachment ledger and [processing review](attachment-processing-completion.md), including npm/cli #9659 and the root officeparser resolution anchor. PR #50 changes the direct dependency and lockfile to 6.3.289 but leaves the root override at 6.2.108. Its security job fails before tests: `Missing: pdfjs-dist@6.2.108 from lock file`.

GitHub queries on 2026-09-12: `repo:mozilla/pdf.js is:issue is:open 6.3.289`; official release v6.3.289 and PDF.js getting-started/API documentation. Inspected the release source at `1c8020a7d4e43668ac287a3ecf9a8dbea17e4c56`, `src/display/api.js`, `src/core/function.js`, `src/shared/util.js`, `test/unit/api_spec.js`, and LICENSE. The byte input, password, text-item and task destruction contracts used here remain present. Minor API changes to action/field/metadata Maps do not affect our adapter. No viewer APIs are introduced.

- [Official release](https://github.com/mozilla/pdf.js/releases/tag/v6.3.289)
- [Pinned source](https://github.com/mozilla/pdf.js/tree/1c8020a7d4e43668ac287a3ecf9a8dbea17e4c56)
- [Upstream #21890](https://github.com/mozilla/pdf.js/issues/21890) reports Indic glyph spacing in raw text extraction across older and current versions. It is a known fidelity limitation, not evidence of a new regression introduced by this update. Do not claim exact multilingual extraction.
- [Upstream #21904](https://github.com/mozilla/pdf.js/issues/21904) concerns saving edited form fields; OpenBot does not edit or save PDFs through the viewer.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| PDF.js distribution | 6.3.289 / 1c8020a7d4e43668ac287a3ecf9a8dbea17e4c56 | Apache-2.0 | Maintained Mozilla release; password and invalid-document tests inspected, not run as a full upstream suite | Published Node >=22.13.0 or >=24; existing legacy Node entry and text API | Select existing released dependency |
| Retain prior PDF.js | 6.2.108 / 0365cbde028bd92e58f2dab1bb70cd30ac7acfd7 | Apache-2.0 | Existing reviewed baseline and OpenBot tests | Viable rollback if current real parser or packaging tests regress | Retain as rollback, not mixed with 6.3 |
| Local parser/fork | None | N/A | No implementation reviewed | No parser gap requires copied code or a fork | Reject |

## Reuse decision

Synchronize the existing exact global override with the direct Server pin and regenerate the lockfile using the repository's npm 10.9.9. Preserve officeparser 7.8.0 and its root resolution anchor; do not weaken clean-install checks or reintroduce 6.1.200. No behavior changes to the parser Worker are required. Failed extraction remains a bounded visible failure. Roll back the complete dependency graph if compatibility checks fail.

## Source incorporation

No upstream source or fixtures copied or substantially adapted. Retain Apache-2.0 notices through existing packaged dependency notices.

## Verification plan

- Clean npm 10.9.9 install, `npm ls pdfjs-dist`, and production audit.
- Existing real encrypted/OpenAction PDF, malformed input, cancellation, Office and OCR tests; full `npm run check`.
- Existing macOS/Windows portable and dual-architecture container CI before merge. Local macOS tests do not establish Windows conformance.
- Keep the corresponding Chinese research note and reuse ledger synchronized.

## Unresolved questions

Upstream text extraction fidelity remains document-dependent; no claim of complete upstream testing or universal PDF support.
