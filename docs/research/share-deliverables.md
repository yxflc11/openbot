# Research: Share deliverables and Bot Employee packages

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: @yxflc11
- Acceptance journey: open the icon-only share control, save a current-channel artifact, or select a channel Bot, review its existing Employee export preview, and save its portable JSON Employee package.
- Security boundary: Server continues to own tasks and artifacts. The renderer selects only an artifact id or the four reviewed Employee package identity fields; the existing trusted native save dialog selects the local destination. Employee export uses the existing reviewed package identity and strong If-Match contract, not model-generated instructions. No public link or transcript export is introduced.

## Search evidence

Search date: 2026-09-10. GitHub query: `site.github.com/electron/electron v44.2.0 dialog showSaveDialog`. Standards query: `site.w3.org WAI ARIA button accessible name icon button`.
Checked existing desktop UI refresh, native agent reports, native report saving and artifact integrity entries in `docs/OPEN_SOURCE_REUSE.md`, plus `docs/research/desktop-ui-refresh.md`.

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| HTML buttons and React | React 19.2.8, existing lockfile | MIT / W3C document terms | Existing rendering tests and WAI button pattern | Keep native button, accessible name, modal lifecycle | Reuse standard |
| Electron dialog and existing native artifact saver | Electron 44.2.0; OpenBot 74109b5 | MIT | Existing report-save tests; Electron dialog docs, window tests and cancellation issue #41914 reviewed | Host-only destination selection, authenticated fetch, bounded bytes, exclusive create | Thin adapter for PNG alongside Markdown |
| Existing Employee export and preview | OpenBot 74109b5 | MIT | Existing employee-package, export API and UI tests | Preserve redaction preview, package identity, If-Match, ETag and SHA-256; no identity or host authority export | Reuse |

Primary references: [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [Electron 44.2.0 dialog source/docs](https://github.com/electron/electron/blob/v44.2.0/docs/api/dialog.md), [Electron 44.2.0 tests](https://github.com/electron/electron/blob/v44.2.0/spec/api-dialog-spec.ts), [cancellation issue](https://github.com/electron/electron/issues/41914), [Electron license](https://github.com/electron/electron/blob/v44.2.0/LICENSE).

## Reuse decision

Use standards and released dependencies already installed. The local gap is a share panel that lists channel artifacts and opens the existing Employee export review for the selected Bot. Reuse ArtifactDownloadLink and native saving rather than enable unrestricted Electron downloads. PNG support retains a bounded MIME/signature check, fixed safe filename, exact extension, authenticated same-connection check, and exclusive write. Unsupported media fail closed.

The user clarified that sharing a template means sharing the Bot itself. Reuse the existing Employee package export with its reviewed profile, verified skills and exclusions. Desktop saving accepts only botId, packageId, generatedAt and downloadReviewToken; the main process constructs the configured Server URL, sends If-Match and validates exact package MIME, ETag and SHA-256. JSON is bounded to 2 MiB and a safe Server filename, with a native .json save destination and existing authentication/connection/active/exclusive-write checks. A 412 response refreshes the preview; cancellation never reports success. No model summary, new backend protocol, dependency or publishing mechanism.

## Source incorporation

No upstream source copied or substantially adapted. Existing dependency notices remain unchanged.

## Verification plan

Test channel scoping, explicit Bot selection, existing Employee preview, 412 refresh, cancellation and artifact/package saving. Native saver negative tests cover MIME, size, signature, reviewed digest/tag, bounded IPC input, extension, stale connection and existing destinations. Run `npm run check`; inspect built renderer and installed macOS app. Record model simulation versus actual inference separately. Windows/Linux require native evidence for platform claims.

## Unresolved questions

The prior task-summary interpretation was explicitly rejected by the user. The share entry now reuses direct Bot Employee package export; no task-template generator remains in scope.

## Local verification result

- Full `npm run check` passed, including production Web and Desktop builds. Focused sharing tests cover channel filtering, explicit Bot export, empty membership and retrying the same failed preview. Native tests cover both file types and reviewed Employee package integrity, stale state, cancellation and exclusive writes.
- The existing macOS alpha.3 bundle was updated locally with the rebuilt renderer/main code, retaining its native Server runtime and user profile. ASAR integrity and ad-hoc signatures were regenerated with the pinned Electron Packager integrity implementation and verified. The previous bundle is retained as a rollback copy.
- The actual installed application launched, displayed the icon-only sharing entry and the recent-files/Bot panel, opened Employee export preview, and saved a valid JSON package through the native macOS save dialog. Saved file mode was 0600. The temporary verification export was removed after validation.
- No paid model request was used for this change. Markdown/PNG saving paths have automated fixture coverage; no new real-model report or real Worker screenshot was created. Windows/Linux were not installed or physically tested in this task.
