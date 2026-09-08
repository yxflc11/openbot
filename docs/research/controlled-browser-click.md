# Research: one reviewed browser click

- Status: Accepted for implementation
- Date: 2026-09-08
- Owner: @yxflc11
- Related issue: follow-up to reviewed skills / user-selected computer interaction
- Acceptance journey: a task explicitly names one URL and one button; an isolated browser observes it, the Server obtains Owner approval, the Worker clicks exactly that observed reference once and returns a screenshot. Rejection, cancellation, human control or changed evidence must prevent the click.
- Security boundary: Server owns Run identity and approval; Worker has an explicit origin opt-in. Browser content and upstream responses remain untrusted. No typing, form-specific inference, shell, arbitrary code, native macOS control or model-directed browsing loop is added.

## Search evidence

Queries: `CopilotKit openbot agent-computer click type screenshot`, `Playwright locator click actionability`. Reviewed the existing Browser computer and deferred egress rows in OPEN_SOURCE_REUSE, ADR-0010, Provider conformance, provider-sdk PreparedAction, Node requestApproval and Server approval policy.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| [CopilotKit/OpenBot agent-computer](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer) | 257c1280d684089be9adb0b35cce262efc7064bf | MIT | Reviewed index.ts, profiles.ts, aria-snapshot.ts, control/authorisation tests; issue #246 is closed but documents why shell must not be inferred from browser control | Existing token/Bot-bound surface, snapshotId + aria-ref, control handover and request cancellation. Browser process is not an isolation boundary by itself | First viable existing adapter; keep service separate |
| [Playwright](https://github.com/microsoft/playwright/tree/v1.62.1) | 1.62.1, locked by that upstream | Apache-2.0 | Official actionability/locator docs and upstream browser tests | Owns real Chromium actions; no reason to reimplement click dispatch | Reuse through upstream, no new OpenBot dependency |
| Cua/Lume declarations | Existing OpenBot f26a3c3 | MIT local declarations | No executable provider in this repo | Would add a new platform, permissions and lifecycle before proving one interaction | Defer native desktop control |

## Reuse decision

Thin adapter over existing `/snapshot`, `/screenshot`, `/click` and `/control`. Accept only a task's
single explicit URL plus `click button "Exact name"` or `点击按钮“准确名称”`. Feature is disabled
unless the Worker explicitly lists that exact origin. Expose browser.input@1 only with this opt-in.
Only a unique enabled observed button is selectable. Freeze its ref, snapshotId, exact name, URL and
screenshot digest before approval. Require the Server's browser.click policy and task-matching
name/URL; the Owner reviews the current frame. After approval verify control, URL and identical
screenshot, then send the original snapshotId/ref once with no retry. Serialize interaction per Bot
and fail if the evidence changes; abort HTTP work when the Run is cancelled. Bound HTTP duration,
JSON bytes, snapshot count and image bytes. Preserve fixed error summaries rather than forwarding
raw service errors.

This does not make arbitrary web content safe: screenshot equality cannot attest JavaScript behavior
or stop navigation initiated by a click. Thus this is an experimental trusted-test-origin slice;
network egress enforcement remains required before enabling untrusted sites. Initially validate
against a task-owned local fixture with no external requests, persistent user data or external effects.
The separate service's control state can veto a click, but cannot grant Server authority.

Source copied or substantially adapted: no. No upstream source enters OpenBot. Pin and exercise the
existing upstream APIs; new local code supplies only missing Server/Worker review and bounded
transport. Keep upstream MIT attribution and existing Playwright notices. Do not claim certification.

## Verification plan

Test default-off behavior, mismatched/ambiguous names, bad refs, unknown origins, response size and
redirects, denied/expired approvals, cancellation, changed screenshot/URL and human takeover.
Exercise the real pinned upstream with its Chromium against the local fixture. Verify real Server
approval and Worker request/response routing, before/after frame and artifact, and no action on denial.
Run npm run check after this project and native CI before handoff. Maintain bilingual docs.

## Validation evidence (2026-09-08)

The real pinned upstream with Playwright 1.62.1 / Chromium headless shell 151.0.7922.34 ran
on macOS arm64 against an isolated loopback page. The QA checkout changes only Bun's bind address
to `hostname: "127.0.0.1"`; this is not an unmodified upstream binary or a production package.
The actual API emits both `eN` and frame-qualified `fNeN` references after navigation. The adapter
accepts these bounded forms and preserves the exact reference; repeat-navigation regression tests
cover the latter. No upstream code is copied into OpenBot.

Actual built Web + Server + PostgreSQL + enrolled Worker + upstream browser passed rejection with
an unchanged screen, Owner approval with exactly one click confirmed through `/read`, completed Run,
post-click screenshot and PNG artifact. Taking human control during approval also prevented the
click after Owner approval. Web viewports 1280x900 and 390x844 had zero page errors and
no horizontal overflow. The page only changes its DOM; no live account, model or external side effect
is involved. Server regression ran 311 tests with the real PostgreSQL integration cases enabled;
one opt-in public-network test was skipped locally. Full `npm run check` passed before handoff.
