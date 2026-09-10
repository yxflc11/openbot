# Research: Documents, OCR, media and attachment lifecycle

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: OpenBot contributors
- Acceptance journey: Upload Office/media files, extract readable text, unlock a PDF using an Owner-supplied password, dictate a draft, download originals, and manage retained channel files.
- Security boundary: Authenticated Owner and Server-scoped immutable attachment IDs. Parse untrusted bytes in a bounded Worker, never execute macros or render document HTML. Passwords are transient; external transcription requires an explicit user action and the configured supported provider.

## Search evidence

- Existing ledger: Channel Bot collaboration and richer attachments; native-reference attachment presentation; Desktop controlled downloads.
- GitHub searches: `site:github.com/harshankur/officeParser password ocr security worker`, `site:github.com/mozilla/pdf.js releases password`, and `site:github.com/naptha/tesseract.js releases`.
- Reviewed officeParser v7.8.0 source at 09b27018450ed4df88fe01494343b43556813b71: package exports, PDF parser, configuration/decompression limits, security regression suite and published fixtures; issue #93 documents older Windows OCR hangs, reinforcing external timeouts and worker termination.
- Primary references: https://github.com/harshankur/officeParser/tree/v7.8.0 ; https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html ; https://github.com/naptha/tesseract.js ; https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder ; https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia ; https://developers.openai.com/api/docs/guides/speech-to-text .

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| officeparser | 7.8.0 / 09b27018450ed4df88fe01494343b43556813b71 | MIT | Released source, exhaustive fixtures and dedicated security tests reviewed; bounded inflation and disabled PDF eval | Node, Windows-compatible JS; DOCX/XLSX/PPTX/ODF/PDF; no macro execution | First viable released document parser |
| PDF.js | pdfjs-dist 6.1.200, pinned by officeparser | Apache-2.0 | Mozilla maintained parser and upstream password API | Thin direct adapter required because officeparser does not forward PDF passwords | Reuse same version; disable eval, remote fetch and font execution |
| Tesseract.js | 7.0.0 | Apache-2.0 | Released OCR engine; worker lifecycle and language-data controls | Wasm OCR on Windows; bounded Worker lifetime, explicit OCR operation | Reuse dependency already used by officeparser |
| Native MediaRecorder + transcription API | MediaStream Recording W3C working draft; OpenAI audio/transcriptions v1, reviewed 2026-09-10 | Web/API reference | Native Chromium recording and official transcription contract | Stop tracks on close/error; bounded recording; configured-provider credentials stay on Server | First viable standards and thin adapter |
| Office, OCR or audio parsing written locally | N/A | N/A | No complete local implementation | Duplicates complex codecs, parsers and security surfaces | Rejected |

## Reuse decision

Use released parsers behind a Server-owned Worker adapter. Bound input bytes, inflated ZIP bytes/entries, output text, job concurrency, elapsed time and worker memory. Only explicitly uploaded channel files are available. Store derived text with source digest; mark truncation and warnings. Original files remain immutable. Use soft-delete/restore and explicit retention cleanup, never delete referenced active-task bytes silently. Extend the existing exact-ID Desktop Save dialog path for original downloads.

## Source incorporation

No upstream source or fixtures copied into production. Runtime dependencies retain their licenses through packaged notices. Synthetic test documents are authored locally; upstream tests are inspected only.

## Verification plan

Positive DOCX/XLSX/PPTX/PDF and media contract tests; malformed files, ZIP bombs, password failures, cancellation, output bounds, cross-channel access, soft-delete/restore and denied download paths. Real OCR fixture and Windows CI runtime checks distinguish actual engines from mocked transcription transport. Provider availability and credentials are reported honestly; no claim of universal provider audio support.

## Security correction before release: PDF.js 6.2.108

The final dependency audit identified [GHSA-hq66-cqwq-w95j / CVE-2026-16633](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j) affecting officeparser's exact 6.1.200 dependency. The [official fixed release 6.2.108](https://github.com/mozilla/pdf.js/releases/tag/v6.2.108), source `0365cbde028bd92e58f2dab1bb70cd30ac7acfd7`, retains Apache-2.0 and requires Node >=22.13.0 or >=24, compatible with OpenBot's 22.22.2 pin. Reviewed `src/display/api.js`, `test/unit/api_spec.js`, `web/pdf_scripting_manager.js` and officeparser's PDF adapter. `getDocument`, password, text extraction and worker-source APIs remain compatible.

Replace the direct pin with 6.2.108 and apply an officeparser-scoped dependency override to the same exact version. Do not downgrade officeparser to its older vulnerable feature line. The advisory is a viewer scripting boundary; OpenBot uses only byte-to-text parsing and never creates PDFViewer/PDFScriptingManager or executes PDF actions. The fixed release is still required rather than relying on that deployment distinction. Regression fixtures include a locally authored OpenAction JavaScript PDF and AES-256 encrypted PDF; verify extraction without executing its action and rerun Office/OCR/parser tests plus audit. The original 6.1.200 candidate table above records initial research, not the final shipped version.

## Attachment manager modality completion (2026-09-10)

The channel file manager was wrapped in a div with `aria-modal`, without actual background inertness, Escape handling or focus restoration. Re-reviewed the existing reuse-ledger entry “Accessible profile navigation and modal review”, pinned [WAI-ARIA APG 7e4034b262bc0d25332e330d8a582aaf34113829](https://github.com/w3c/aria-practices/tree/7e4034b262bc0d25332e330d8a582aaf34113829), [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [WCAG H102 native dialog technique](https://www.w3.org/WAI/WCAG22/Techniques/html/H102). Reuse OpenBot's existing `useModalDialog` thin adapter and native `dialog.showModal`; no dependency or upstream source copy. Native modality owns focus containment and inertness; the heading receives initial focus for structured file-list content, explicit close/Escape return through the shared hook and restore the opener. Backdrop presses close only when outside the dialog rectangle. Tests check lifecycle wiring and opener restoration; jsdom mocks do not prove browser-native focus containment, which needs a real browser check.

The npm 10.9.9 workspace graph reproduced [npm/cli #9659](https://github.com/npm/cli/issues/9659): a transitive override was dropped through a workspace link. A root development resolution anchor for the same officeparser 7.8.0 release makes the exact global PDF.js 6.2.108 override effective; Server retains its production dependency. Remove this temporary anchor when the maintained parser pins the corrected PDF.js version or the reviewed npm release resolves linked overrides correctly. The lockfile and production audit, not the manifest alone, verify the shipped parser version.
