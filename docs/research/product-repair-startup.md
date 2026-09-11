# Research: retained startup, cancellable attachments and explicit release targets

- Status: Accepted for implementation
- Date: 2026-09-11
- Owner: @yxflc11
- Acceptance journey: reopen the retained Desktop workspace, cancel an in-flight attachment without changing a newer draft, and prepare exactly the requested native installers.
- Security boundary: OS-protected secrets remain in the main process; existing bootstrap bytes are never replaced on failure; cancellation cannot grant authority or delete referenced files.

## Search evidence

Reviewed the existing Integrated Desktop onboarding, retained startup, channel attachments and installable delivery entries in OPEN_SOURCE_REUSE. The actual installed app is alpha.5 while the repository is alpha.6; installed-version verification is required before closing UI defects.

Queries on 2026-09-11: GitHub `electron/electron safeStorage async 44`, `electron/packager osxSign osxNotarize`; primary Electron safeStorage API, WHATWG Fetch AbortController and W3C MediaRecorder. Reviewed fixed Electron 44.2.0 [source](https://github.com/electron/electron/blob/v44.2.0/shell/browser/api/electron_api_safe_storage.cc), [tests](https://github.com/electron/electron/blob/v44.2.0/spec/api-safe-storage-spec.ts) and [startup](https://github.com/electron/electron/blob/v44.2.0/shell/browser/electron_browser_main_parts.cc). Its tests explicitly cover sync-to-async and async-to-sync interoperability. Open issues/PRs 53670 and 53662 concern deprecating/removing synchronous methods, not a reason to remove compatibility ourselves.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Electron safeStorage async API | 44.2.0 / aa650d7 | MIT | Released 2026-09-04; upstream Unicode, rejection, interoperability and restart tests; installed type declarations checked | Same macOS Keychain and Windows DPAPI protection; nonblocking startup; keep pre-ready Preview namespace | Reuse dependency |
| electron-store | 11.0.2 / e1470fd | MIT | Existing reviewed candidate | Does not replace OS encryption or solve signing trust | No additional wrapper |
| Fetch AbortController / MediaRecorder | Living Fetch standard and MediaStream Recording W3C draft, accessed 2026-09-11; Electron 44.2.0 implementation | WHATWG/W3C document terms | Existing renderer tests exercise late completion, unmount and denied permission | Abort client work; fence late responses; recording remains local until explicit attach/transcribe | Reuse standard |
| Existing installer verifier + electron-builder | OpenBot 729c164310570aa0f3bfbb0be671242ee5425ba4; builder 26.16.0 / f461097 | MIT | Source, size, checksum, target and CI authority tests already present | Explicit target list adds no executable trust | Thin adapter |

## Reuse decision

Use asynchronous encryption/decryption in the existing controller without changing the bootstrap format. Show an OS-credential step while it is pending; do not regenerate credentials when decryption fails. A canonical profile containing any retained setup, connection or bootstrap evidence takes precedence over Preview. Preserve the original selected profile in place.

Attachment cancellation stops pending client work and fences late results; an already stored but unsent original may remain in the attachment manager. Do not pretend cancellation retracts a completed remote operation. Voice upload cancellation returns to local review. Use attachment-id lifecycle cleanup so a response for a replaced file cannot update the replacement.

Release targets are an explicit nonempty unique subset of the three reviewed targets; retain legacy CLI compatibility. Validate all requested manifests before creating output. The default release workflow selects macOS arm64 plus Windows x64; published assets remain immutable.

## Source incorporation

No upstream source copied or substantially adapted. No new dependencies. Existing notices remain applicable.

## Verification plan

Add regression tests for pending credential access, rejected decrypt preservation, partial canonical profiles, cancelled uploads and late responses, and exact two-target releases including missing/tampered/wrong-source failures. Run targeted tests and `npm run check`; verify a packaged macOS workspace separately. Windows native CI, real microphones and a stable Developer ID certificate are distinct evidence requirements. Sync/async fixture tests use an isolated profile, never print or export user credentials.

## Unresolved questions

A stable Developer ID certificate is required to eliminate ad hoc update trust prompts; local code cannot manufacture it. A cancelled HTTP request may already have committed on the Server.

## Optional Developer ID packaging path

Reviewed installed Packager 20.3.0 (`f461097` builder is a different layer), its `mac.js` lifecycle and public `afterCopyExtraResources`, `osxSign` and `osxNotarize` options; its locked dependencies are osx-sign 2.7.0 and notarize 3.1.1 (MIT, released upstream packages). Packager copies/renames resources, applies ASAR integrity, then signs/notarizes. Therefore signed builds must flip Electron fuses inside the existing resource-copy hook before the signing pass; flipping after signing invalidates the certificate. Unsigned local packages retain the existing path.

Select the already installed Packager public adapter with an explicit Developer ID identity and existing notarytool Keychain profile; both are required together. Use only JIT and audio-input entitlements for Electron application/helpers, no camera/location/device grants. Strict codesign, stapled-ticket and Gatekeeper checks must pass before reporting signed distribution. The machine currently reports zero valid signing identities. This enables a certificate-backed pipeline but does not claim actual notarization, prompt-free upgrades, or a signed release without those prerequisites. No upstream source copied and no new dependency.
