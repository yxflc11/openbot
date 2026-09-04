# ADR-0043: Desktop persists setup intent before service effects

- Status: Accepted
- Date: 2026-09-05

## Context

OpenBot Desktop is always a Client, but onboarding must also let a user express whether this
computer should work as a Worker Host, host the Server, or remain part of an independently deployed
system. A user may plan several Worker computers, and every one can still be used as a normal
Desktop Client. The choice must survive restart without becoming an installation, enrollment,
authorization, platform-support, or license claim.

Full candidate and license evidence is recorded in the
[Desktop setup-plan research](../research/desktop-setup-plan.md).

## Upstream review

React `19.2.8`, WAI-ARIA APG `7e4034b2`, Electron `44.2.0`, and
`write-file-atomic` `8.0.0` are already selected and distributed by OpenBot. XState `5.31.1` and
React Hook Form `7.77.0` / `5b20741` are maintained and tested, but neither closes the product,
authority, or persistence gap in this bounded intent step. Exact maintenance, issue, test,
platform-fit, and license evidence is recorded in the research document.

## Reuse decision

Reuse the existing React renderer, native form semantics, typed context-isolated bridge, and
restricted atomic-file policy. Implement only the strict OpenBot plan schema and deterministic
checklist projection. Add no new runtime dependency, generic form layer, state machine, service
launcher, or renderer storage boundary.

## Decision

- Present the four documented compositions before the first Server connection: Client only,
  Client plus local Worker Host, local Server with optional local Worker Host, and advanced modular
  self-hosting.
- Record a bounded planned Worker-computer count. It is a progress-planning input, not a license
  limit. A local Worker counts as one of those computers.
- Persist only a strict, versioned public intent object below the Desktop application data
  directory. Reuse the existing restricted atomic JSON-file policy and keep the plan outside the
  renderer's browser storage.
- Expose only typed read/save operations over the existing context-isolated bridge. Validate the
  exact top-frame sender and every input again in the main process.
- Derive checklist rows and readiness labels from the canonical plan. Persist no `installed`,
  `connected`, `authorized`, or `supported` boolean that could drift from authoritative evidence.
- Saving or changing the plan performs no process launch, network request, privilege escalation,
  service mutation, enrollment, or grant. Effectful installers and enrollment consume the plan
  only after their own review and explicit user confirmation.
- Client-only and Client-plus-Worker plans continue to the existing verified Server-origin flow.
  Host and advanced plans may connect to an already deployed Server, but the interface must state
  that automatic Server/Worker installation is not yet implemented.
- Use existing React state and native form controls. Do not add XState or React Hook Form for this
  bounded intent step; reconsider a state machine when real cross-platform installer transactions
  require recovery, rollback, and concurrency.
- Missing, invalid, oversized, linked, exposed, or contradictory configuration returns to setup
  and never selects a default service role.

## Source incorporation

No React, Electron, WAI-ARIA APG, `write-file-atomic`, XState, or React Hook Form source, test, or
template is copied or substantially adapted. Public APIs and semantic guidance are used directly.
No new runtime dependency or third-party notice is introduced.

## Verification plan

Pure, file, IPC, preload, and renderer tests cover every mode invariant, count bound, deterministic
checklist, restart, invalid state, forged sender, no-request-before-plan behavior, and continuation
to the existing Server flow. Hosted package jobs prove only portable build/test compatibility.
Real service installation and real-device support remain later Owner checkpoints.

## Consequences

Users can describe the intended OpenBot topology in product language and resume it after restart,
while future platform adapters receive one canonical bounded input. The UI can distinguish current
evidence from planned work instead of implying that selecting a card installed or authorized
anything.

The next slice must still implement a signed, recoverable Server bootstrap and the separate Worker
Host install/enrollment path. This ADR grants neither privilege nor permission to merge or release
those effects.
