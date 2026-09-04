# Research: Owner-managed Employee profile details

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: An authenticated Owner opens an Employee's configuration view, edits the
  role and profile description, saves against the revision they reviewed, and sees the refreshed
  profile and append-only evolution event on every connected device.
- Security boundary: OpenBot Server remains the only writer. Profile text cannot change a Worker
  Host assignment, model, capability, skill state, policy grant, or credential. A stale form is
  rejected with `409 Conflict`; audit/evolution records contain changed-field names, not a copy of
  potentially personal description text.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/NousResearch/hermes-agent profile edit name description desktop source`
  - `site:github.com/openclaw/openclaw agent profile name description update source`
  - `site:github.com/backstage/backstage catalog entity edit form optimistic concurrency etag`
  - `site:github.com/kubernetes/kubernetes resourceVersion update conflict metadata spec`
- Standards and primary documentation queries:
  - Hermes Desktop `edit-profile-dialog.tsx`, gateway profile metadata compare-and-swap tests, and
    profile description routing semantics at commit `63279301`;
  - Kubernetes API update and `resourceVersion` conflict behavior at v1.36.2;
  - existing OpenBot native form, exact-Origin Owner session, revision-checked memory mutation, and
    content-free realtime invalidation contracts.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - Bot configuration JSON, Employee aggregate profile, evolution ledger, memory revision
    implementation, API error mapping, realtime profile refresh, configuration view, migrations,
    and current retroactive audit ledger.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Hermes profile editor and gateway UI metadata CAS | [`63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), especially `apps/desktop/src/plugins/hermes-bots/edit-profile-dialog.tsx` and `tests/tui_gateway/test_profiles_ui_meta_cas.py` | MIT | Active project with Desktop edit flow and explicit concurrent-writer tests | Directly supports the Owner's Hermes-inspired Employee concept: editable description, staged save, Server-preferred metadata, revision conflict instead of lost updates. Its filesystem/gateway storage is not OpenBot's authority | Adapt behavior and test cases, not source |
| Kubernetes API updates | [`v1.36.2`](https://github.com/kubernetes/kubernetes/tree/v1.36.2) and [API concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/#updates-to-existing-resources) | Apache-2.0 / CC-BY-4.0 docs | Mature API with conformance and conflict tests | Opaque resource version and `409` lost-update rejection map directly to an Owner editing a Server snapshot | Adopt revision semantics |
| OpenBot Owner memory mutation | commit `7998b0b` | MIT | PostgreSQL compare-and-swap, strict Zod input, content-free audit, UI conflict reload, and real DB tests | Already implements the exact local persistence/security mechanism in the same Server and Web stack | Reuse directly |

## Reuse decision

- Selected option: reuse the existing OpenBot revision mutation path and adapt Hermes/Kubernetes
  profile-edit and compare-and-swap behavior.
- Selected upstream or standard: Hermes profile description UI/CAS tests and Kubernetes
  resource-version conflicts.
- Why this is the first viable option: importing another profile store would split Employee
  identity. OpenBot already has PostgreSQL, strict Owner commands, conflicts, evolution, audit, and
  multi-device invalidation; the missing code is a narrow identity-details mutation.
- Exact OpenBot-specific gap: persist a bounded description and monotonically increasing profile
  revision beside the Bot row; atomically update role/description; append one non-content-bearing
  evolution/audit record; expose a configuration form that sends the reviewed revision; preserve
  the biography in new safe templates while accepting older v1 packages that omit it.
- Upgrade, replacement, or exit plan: keep the command stable as richer configuration sections are
  added. New fields require separate schemas, changed-field audit names, and security review; name,
  model, host binding, appearance, and grants are explicitly outside this change.
- Failure behavior when the upstream is missing, incompatible, or compromised: no upstream runtime
  is loaded. PostgreSQL compare-and-swap fails closed; the UI preserves the draft, reports a newer
  Server revision, and requires the Owner to load it; no partial evolution event is committed.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no Hermes or Kubernetes source is copied. OpenBot reuses its own
  memory mutation structure, Hono route, Zod schema, PostgreSQL transaction, SSE invalidation, and
  existing form styles. Portable biography text reuses the existing package schema and sensitive
  content scanner rather than introducing a second transfer format.
- Required copyright or license notice location: citations and licenses are recorded here and in
  `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: strict input schema; authenticated route; successful role/description update;
  exact revision increment; evolution/audit changed fields; content-free realtime invalidation;
  stale concurrent update; no-op rejection; Web API request and form rendering; full repository
  suite.
- Negative and fail-closed tests: unauthenticated request, unexpected fields, blank/oversized role,
  oversized description, stale revision, unchanged values, and attempts to smuggle authority fields
  must fail without partial writes.
- Platforms and devices: Server-owned Web flow shared by Windows, macOS, Linux, and mobile browsers;
  no native-client claim.
- User-visible documentation and translations: update English canonical README/API/Employee/reuse
  docs and matching Simplified Chinese documents.
- Support level that the evidence permits: Owner editing of role and descriptive biography only.
  It is not host, model, tool, skill, permission, or appearance configuration.

## Unresolved questions

- Employee display-name changes need unique-name conflict UX and stable mention behavior.
- Model policy, preferred Provider, host binding, and appearance editing each cross different trust
  boundaries and remain separate research slices.
