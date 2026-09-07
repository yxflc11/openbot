# Research: Scoped source reading and Agent report delivery

- Status: Implemented; local grouped validation passed
- Date: 2026-09-08
- Owner: OpenBot maintainers
- Related issue: Usable Agent delivery milestone, project 2
- Acceptance journey: An Owner gives a Bot explicit public source URLs; the native Agent reads
  bounded text, synthesizes a report, and returns a downloadable Markdown file attached to its Run.
- Security boundary: Only Server-owned tools operate. The model selects a source index from the
  current user's task, never an arbitrary URL, local path or new authority. Source content is
  untrusted. Report bytes become visible only with the completed Run, Bot reply and audit commit.

## Search evidence

- Search date: 2026-09-07/08. GitHub/npm queries: `ipaddr.js SpecialRanges`, `html-to-text limits`,
  `mozilla readability releases`, maintained source/tests/licenses, and open issues.
- Reviewed `ipaddr.js` IPv4/IPv6 classification source and issue #203 (IPv4-compatible IPv6 gap).
  Restrict IPv6 additionally to global `2000::/3` before accepting `unicast`; mapped, translated,
  compatible, local, documentation, multicast and transition addresses are rejected.
- Reviewed html-to-text's documented parser limits and selector formatters, npm integrity and
  source commit. Issue #328 notes missing release notes for v10; source and published package are
  pinned rather than relying on a missing GitHub Release record. Existing test workflow and
  per-formatter tests remain upstream verification, not proof of OpenBot's integration.
- Primary documentation: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html),
  [Node HTTPS](https://nodejs.org/api/https.html),
  [html-to-text options](https://github.com/html-to-text/node-html-to-text/tree/1c39d9885075836a7e45d0236c7a5541dede8e52/packages/html-to-text),
  and [Mozilla Readability](https://github.com/mozilla/readability/tree/04fd32f72b448c12b02ba6c40928b67e510bac49).
- Existing ledger: native Agent loop, atomic sensitive files, artifact-read integrity, Server
  file artifacts, and Docker browser adapter. Worker PNG transport is retained without broadening
  its protocol. Native text artifacts use a separate Server-owned input contract.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| WHATWG URL + Node HTTPS | Existing Node 24.20.0 production runtime | Node.js license; WHATWG terms | Maintained core HTTP/TLS/DNS tests | Standard URL parser and request API support explicit DNS pinning, original-host TLS verification, no pooling or redirects, bounded bytes and cancellation | Select standard transport with narrow policy adapter |
| ipaddr.js | 2.5.0 / dc55282780d8702bac31ef012ca52e4a77fbca1f | MIT | Published npm integrity; source special-range tables and existing tests inspected; IPv4-compatible IPv6 open issue reviewed | Avoid local IP parsing; require standard literal parsing and global-unicast class, with explicit global IPv6 range guard | Select released dependency |
| html-to-text | 10.0.1 / 1c39d9885075836a7e45d0236c7a5541dede8e52 | MIT | Published npm integrity, maintained formatter/parser tests; limits and changelog issue reviewed | Converts bounded HTML to plain text without a browser, script execution, resource loads or a DOM renderer | Select released dependency |
| Mozilla Readability | 0.6.0 / 04fd32f72b448c12b02ba6c40928b67e510bac49 | Apache-2.0 | Maintained reader-mode extraction tests and Firefox use | Better article extraction but requires a separately reviewed DOM implementation; source may be documentation or tables rather than articles | Defer article-specific enhancement; the text converter is the first viable dependency for this scope |
| Existing AI SDK + atomic artifact storage | ai 7.0.93, write-file-atomic 8.0.0 | Apache-2.0; ISC | Existing real-SDK, atomic storage, digest read and PostgreSQL terminal-transaction tests | Reuse loop and durable artifact contract; no shell, external messaging or Worker authorization is introduced | Extend bounded Server integration |

## Reuse decision

- Selected option: standard HTTPS transport, released IP/text libraries, and thin Server adapters.
- Exact gap: bind at most three HTTPS sources to a claimed Run, resolve and validate all DNS answers
  once and pin the connection to a validated address, bound response time/size/text, prepare at most
  two Markdown reports, and atomically link their immutable records to the terminal Run.
- Reject redirects, cookies, credentials in URLs, alternate ports, compression, private/mixed DNS
  answers and unspecified sources. Certificate verification uses the original hostname. The
  application does not honor arbitrary proxy environment variables for this tool.
- Sources and tool errors never override Server policy. Failures remain bounded visible results;
  no automatic retry or follow-up network request is granted by a webpage or model.
- Output uses UTF-8 text, safe attachment names, existing SHA-256 read verification, `nosniff` and
  attachment disposition. It is never rendered as executable HTML or executed by Server.
- Replacement: a future governed MCP/Worker adapter can implement the same scoped source/report
  interfaces. Arbitrary local files, PDF parsing, browser actions and child Workers remain separate
  milestones; this change does not claim those capabilities.

## Source incorporation

- Source copied or substantially adapted: no. Published dependencies and public APIs only.
- Preserve MIT package licenses and record the new dependencies in `THIRD_PARTY_NOTICES.md` and
  the reuse ledger. Existing AI SDK attribution and Hermes-inspired learning attribution remain.

## Verification plan

- Complete this project before its grouped check.
- Unit tests: URL and DNS bypass cases, mixed answers, pinned TLS request parameters, timeout,
  cancellation, redirects, byte/type/encoding limits, script/style omission and tool input limits.
- Real-SDK fixtures: source observation reaches a later step; prepared report becomes a durable
  artifact only after scope/settings revalidation and terminal commit. Failure removes staged bytes.
- PostgreSQL fixture: completion/reply/artifacts/audit are atomic, revoked scopes cannot publish,
  duplicate completion cannot duplicate artifacts, and artifacts remain channel-bound.
- API/UI: attachment response identity, digest and filename; report card/download in Desktop and
  Web; no broken image preview for text artifacts. Real model billing is not part of fake fixtures.

## Unresolved questions

- Live provider credentials and real-world response quality need separate evidence. PDF/office
  input, web search, arbitrary browsing, Worker computer actions and report editing are not included.

## Verification results

- Full `npm run check`, 12 disposable PostgreSQL integration tests and production npm audit passed
  (zero vulnerabilities). Real built UI plus real Server/database verified report download, retained
  provenance, Unicode filename, anonymous 401, refresh retention and desktop/mobile widths.
- The browser journey uses deterministic model/source fixtures, not live paid model evidence.
- Actual local DNS returned reserved 198.18.* addresses for two public pages; the source reader
  correctly denied them. Successful live public HTTPS remains unverified in this network.

## Desktop save adapter review (before implementation)

- Browser QA passed, then source review found `lockDownSession` intentionally rejects every
  `will-download`. A native report save adapter is required; do not relax that global policy.
- Reviewed Electron 44.2.0 (existing reviewed aa650d7 release) official
  [showSaveDialog](https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogwindow-options),
  [DownloadItem](https://www.electronjs.org/docs/latest/api/download-item), existing IPC sender
  validation and authenticated Session fetch. Electron is MIT and already shipped.
- First viable standard: parented native save dialog plus Node exclusive file creation. Reject a
  general DownloadItem grant: it would expose broader URL/redirect/MIME/download authority and
  does not itself bind a download to a Server-authorized report.
- Renderer sends only an artifact UUID. Main fetches one fixed content route through the configured
  authenticated Server session, bounds UTF-8 Markdown at 32 KiB, validates the suggested name, and
  opens a native save dialog. Recheck connection, window lifetime and authentication before saving.
  The user-selected path never enters renderer IPC. Save only a new `.md` file with exclusive
  create; do not overwrite files, auto-open results, or allow arbitrary local/network paths from
  renderer. One pending save at a time; cancellation creates no file.
- No new dependency or upstream source copied. Add controller/preload tests and actual Electron
  renderer-to-main-to-file QA; distinguish dialog test interception from manual native dialog use.
