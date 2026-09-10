# Research: Channel attachment presentation and direct input

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: OpenBot contributors
- Acceptance journey: Drop or paste local files into a channel draft; inspect/remove uploads; read authenticated file cards after sending.
- Security boundary: Existing channel-scoped Owner-authenticated metadata/content routes remain authoritative. No clipboard permission request, external image URL, executable document preview, or client-generated access grant.

## Search evidence

- Existing ledger: Channel Bot collaboration and richer attachments; existing [attachment review](channel-attachments.md) and [native channel review](channel-native-reference.md).
- Primary standards: [File API](https://w3c.github.io/FileAPI/), editor draft 23 August 2026; [HTML DataTransfer files](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files); [object URL lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static). Reviewed standard's linked WPT suite and revoke/dereference rules.
- GitHub queries: `react-dropzone/react-dropzone releases`, reviewed release page v19.1.1 / 4599a84 and reported drag/drop issues #1362 (disabled drop navigates), #1409 (file items without Files type), #1420 (Linux Chromium drops), #1455 (drop during picker). Attempts to open tagged source/tests/license returned cache-miss/404; dependency source review is therefore incomplete and dependency is not adopted.

## Candidate comparison

| Candidate | Pinned version | License | Fit and evidence | Decision |
| --- | --- | --- | --- | --- |
| HTML drag/drop and clipboard event File objects; File API blob URLs | File API editor draft 2026-08-23; existing React 19.2.8 / 1dd4ecb | W3C terms; MIT | First viable standard. Existing raw upload adapter; event handlers read only user-provided files. Object URLs are revoked on replacement/removal/unmount. Test drag/drop navigation prevention and stale channel requests. | Select standard plus existing adapter. |
| react-dropzone | v19.1.1 / 4599a84 release inspected | Not incorporated | Maintained releases and relevant bug history; exact source/license/test inspection unavailable. Adds directory/picker behavior outside present bounded upload gap. | Not adopted; no source copied. |

## Reuse decision

Use native input, drop and paste handlers feeding one existing upload path. Fetch metadata before rendering names/type or content. Bound metadata response and content bytes; only PNG/JPEG become local blob previews. Other types download through channel content endpoints. At most eight unique markers render per message; malformed markers never become requests. Preserve legacy inline attachments and text formatting. Retain partial successful uploads, file size/count limits, cancellation and channel isolation.

## Source incorporation

No source copied or substantially adapted. No new dependency or proprietary resource incorporated.

## Verification plan

Component tests cover paste text default handling, drop prevention, duplicate/size rejection, partial upload failure, aborted/late completion, card metadata scope, failed authorization, bounded parsing and image URL revocation. Native/macOS and browser visual verification remains the parent integration task; no new OS support claim.
