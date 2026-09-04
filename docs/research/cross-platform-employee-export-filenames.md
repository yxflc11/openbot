# Research: Cross-platform Employee export filenames

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pending
- Acceptance journey: an Owner can export an Employee whose display name is Unicode, contains path
  or control characters, or equals a Windows device name, and receive a short ASCII JSON filename
  that is valid on Windows, macOS, and Linux.
- Security boundary: Employee display text may influence only an advisory download name. It must
  not inject a response header, select a directory, produce an executable suffix, or create a
  platform-reserved device name. The package bytes and reviewed-download validator are unchanged.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/honojs/hono Content-Disposition filename attachment header source`
  - `site:github.com/sindresorhus/filenamify sanitize filename npm source`
  - `github sindresorhus filenamify latest release 2026`
  - `site:github.com/sindresorhus/filename-reserved-regex release`
- Standards and primary documentation queries:
  - `site:rfc-editor.org RFC 6266 Content-Disposition filename security path separators`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `apps/server/src/employee-package.ts` already creates a bounded lowercase ASCII stem;
  - `apps/server/src/app.ts` puts that stem in `Content-Disposition`;
  - `docs/research/employee-export-review-binding.md` covers the exact response bytes and validator;
  - `docs/OPEN_SOURCE_REUSE.md` records the current portability boundary.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| RFC 6266 | [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html), especially sections 4.3, 7, and Appendix D | IETF Trust | Standards-track HTTP specification | Requires valid sender syntax and warns about path segments, controls, special names, unsafe extensions, quoting, and non-ASCII interoperability | Adopt as the response-header contract |
| `filename-reserved-regex` | [`4.0.0`](https://www.npmjs.com/package/filename-reserved-regex/v/4.0.0) | MIT | Small maintained package with zero runtime dependencies and AVA tests; its published manifest references `index.d.ts` but omits that file from the tarball | Exposes a focused Windows device-name predicate, including names that remain reserved before an extension; runtime is suitable but its release needs an external declaration | Add as an exact Server dependency with the matching DefinitelyTyped declaration |
| `@types/filename-reserved-regex` | [`3.0.0`](https://www.npmjs.com/package/@types/filename-reserved-regex/v/3.0.0) | MIT | DefinitelyTyped declaration for both the default and named predicate exports | Restores strict TypeScript checking for the unchanged v4 runtime API without adding production code | Add as an exact Server development dependency |
| `filenamify` | [`7.0.3`](https://www.npmjs.com/package/filenamify/v/7.0.3) | MIT | Maintained, widely used, tested package with browser entry point | Solves general filename replacement and byte truncation, but OpenBot already owns a stricter ASCII slug and fixed JSON suffix | Do not add the broader dependency |
| Existing OpenBot filename builder | commit `f273d5f` | MIT | Covered indirectly by Employee package tests | Already removes separators, controls, quotes, dots, spaces, non-ASCII output, and bounds the stem, but `CON`, `NUL`, `COM1`, and related names remain invalid on Windows even with an extension | Reuse and close only the reserved-name gap |

## Reuse decision

- Selected option: standard plus one focused dependency around the existing local adapter.
- Selected upstream or standard: RFC 6266, `filename-reserved-regex` 4.0.0, and its
  `@types/filename-reserved-regex` 3.0.0 declaration.
- Why this is the first viable option: the current ASCII slug is intentionally narrower than a
  general sanitizer. The maintained zero-dependency predicate supplies the one missing
  cross-platform rule without replacing OpenBot's deterministic name contract.
- Exact OpenBot-specific gap: apply the upstream Windows device-name check after slugging and add a
  deterministic `-employee` disambiguator before OpenBot's fixed `.openbot-employee[.dsse].json`
  suffix.
- Upgrade, replacement, or exit plan: keep the dependency exact-pinned. Recheck its device-name
  set during dependency upgrades; it can be replaced by a standards-equivalent predicate without
  changing the public filename shape.
- Failure behavior when the upstream is missing, incompatible, or compromised: package installation,
  type checking, or Server build fails rather than silently emitting unchecked names. Tests lock
  path/control, Unicode fallback, length, suffix, and Windows-reserved cases.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: OpenBot imports the released `windowsReservedNameRegex` API. No
  upstream regular expression or test source is copied.
- Required copyright or license notice location: runtime and declaration metadata remain in the
  lockfile; this record and `docs/OPEN_SOURCE_REUSE.md` record both exact MIT-licensed sources and
  the compatibility decision.

## Verification plan

- Automated tests: build unsigned and signed Employee exports for normal, Unicode-only, hostile,
  long, and Windows device names; assert a bounded ASCII filename and fixed JSON suffix.
- Negative and fail-closed tests: prove that separators, quotes, controls, header delimiters,
  executable suffixes, trailing dots/spaces, and reserved device stems never reach the result.
- Platforms and devices: one deterministic name contract shared by browser Clients and Windows,
  macOS, and Linux download targets.
- User-visible documentation and translations: document the portable advisory filename rule in the
  English API reference and Simplified Chinese translation; record the dependency in both reuse
  ledgers.
- Support level that the evidence permits: contract-tested portability; real browser save-dialog
  behavior remains outside automated support claims.

## Unresolved questions

- A future localization review may add RFC 8187 `filename*` for a human-readable Unicode companion.
  The v1 safe ASCII filename remains the canonical fallback and Client download name.
