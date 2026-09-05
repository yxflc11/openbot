# Research: Workspace skills and automation destinations

- Status: Accepted before implementation
- Date: 2026-09-05
- Owner: @yxflc11
- Acceptance journey: The Owner opens Skills from the sidebar, searches actual Employee skill
  records, and opens the existing review surface. Automations use the authenticated Server API to
  create and manage recurring channel tasks, with honest unavailable and failure states.
- Security boundary: These screens never activate skill files, invent marketplace inventory, or
  execute client timers. Server identity, approvals, routing, and schedules remain authoritative.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `agentskills agentskills specification metadata name description security`,
  existing Agent Skills specification, tests, releases, and open issue index; React `v19.2.8`.
- Primary documentation: [Agent Skills metadata specification at the reviewed commit](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/specification.mdx),
  [React Effect lifecycle](https://react.dev/reference/react/useEffect), and
  [W3C form feedback](https://www.w3.org/WAI/tutorials/forms/notifications/).
- Existing entries checked: Skill write review, Portable skill format, Accessible profile
  navigation, and Web component interaction tests in `docs/OPEN_SOURCE_REUSE.md`;
  `research/owner-skill-review-surface.md`; current Employee profile endpoint and review component.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Fit and decision |
| --- | --- | --- | --- | --- |
| Agent Skills | `69ef37e9424c0a7ea9dd2293b559e43ec8176379` | Apache-2.0 code; CC-BY-4.0 documentation | Specification, `skills-ref/tests`, releases page and open issue index reviewed | Adopt the existing metadata boundary; the standard defines packages, not a trusted hosted marketplace. No package is downloaded or executed here. |
| React with native HTML controls | `19.2.8` | MIT | Existing exact-pinned runtime; maintained release and Effect cleanup guidance, existing jsdom interaction tests | Reuse native form labels, search, status messages, and cleanup. No additional client state or UI dependency. |
| OpenBot Employee review | Base commit `fc0ad85` | MIT | Existing authenticated profile GET and conditional Owner skill-state tests | Reuse the authoritative records and existing profile review rather than duplicate skill activation. |

## Reuse decision

- Selected option: open metadata standard plus a thin adapter over existing application APIs.
- Exact local gap: a discoverable workspace-wide skill index, bounded parallel profile loading,
  search/filter, source/state disclosures, and callbacks into the existing review. The automation
  form adapts the separately researched Server schedule contract, without owning execution.
- Automation cadence is fixed elapsed minutes, with a future first-run timestamp converted from
  local time to ISO UTC. Display the zone and do not claim DST-aware calendar recurrence.
- Upgrade/exit: a future trusted catalog can replace the read projection after package validation
  and license review exist. Schedule execution can change behind the Server API.
- Failure behavior: failed skill profiles are named as unavailable; they are never silently
  reported as empty. Older Servers with missing schedule endpoints disable creation and offer
  retry. Mutations are acknowledged only after Server success. Authentication failures retain
  the existing unauthorized event path.

## Source incorporation

- Source copied or substantially adapted: no.
- Uses the repository's existing React, domain types, API error class, icons, and review component.
- No new dependency, third-party asset, or upstream code incorporation requires new notices.

## Verification plan

- Focused jsdom interactions cover real record search, review callback, partial read failure,
  Server create/pause/delete request shapes, failure persistence, and no mutation on mount.
- Verify CSS in the root's isolated Desktop preview at regular and compact widths.
- The root workstream maintains English and Chinese user documentation and the reuse ledger.
- Permitted claim: metadata discovery and Server-owned recurring submissions. A skill store,
  executable installation, model inference, and arbitrary client-side background execution are
  outside this change.
