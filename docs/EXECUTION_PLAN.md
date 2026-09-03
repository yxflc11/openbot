# Goal-mode execution plan

[English](EXECUTION_PLAN.md) · [简体中文](EXECUTION_PLAN.zh-CN.md)

## Objective

Advance OpenBot as an open-source, self-hosted, cross-platform digital employee platform inspired
by the always-on experience of Grok Bot. The Server remains the source of truth, Worker Hosts remain
replaceable, and portable Employees never carry authority to a computer.

This workstream is designed for at least **8 hours of continuous Codex goal-mode execution**. A
completed slice is a checkpoint, not a stopping condition. Work pauses only for a real decision,
missing authority, or external dependency that cannot be resolved safely inside the repository.

## Working baseline

The development line already contains:

- persistent local channels, named Bots, Runs, approvals, artifacts, and realtime updates;
- a versioned Node contract for Windows, macOS, Linux, containers, VMs, and managed devices;
- a seven-view Employee profile with evolution, skills, safe decision summaries, memory, records,
  and configuration;
- a strict `openbot.employee/v1` template schema and an Owner-authenticated export preview;
- default structural exclusion of identity, authority, memories, and work history;
- strict, bounded, read-only import inspection with checksum, semantic, sensitive-text, and current
  Worker Host compatibility checks.
- WAI-ARIA-based employee profile tabs and native modal focus behavior for create/import/export
  flows, with desktop and phone browser evidence.
- Owner-only bounded memory create/edit/delete, optimistic revisions, credential-value blocking,
  and a content-free lifecycle audit. Memory remains absent from v1 Employee packages.

The current browser Provider is still read-only. Native desktop control and production Node trust
are not part of this baseline.

The codebase now also contains experimental Owner-managed encrypted Ed25519 keys, explicit
public-key trust, rotation/revocation, DSSE signed export, verified quarantine preview, and reviewed
fresh-identity activation. Native keyrings, KMS, public trust distribution, selective cloning, and
ownership transfer remain future adapters.

## Continuous execution schedule

Times are work budgets, not release dates. If a slice finishes early, its remaining budget moves to
tests, hardening, or the next slice.

| Elapsed budget | Status | Slice | Deliverable | Acceptance gate |
| --- | --- | --- | --- | --- |
| 0:00–0:45 | Complete | Product and safety baseline | English source docs plus Chinese translation for Employee, Worker Host, Run, portability, and visible decision traces | No text claims that skills grant authority or that raw chain-of-thought is exposed |
| 0:45–1:45 | Complete | Cross-platform Node contract | Platform, architecture, device class, isolation, trust tier, and versioned capability descriptors | Windows, macOS, and Linux fixtures validate without changing Server ownership boundaries |
| 1:45–3:15 | Complete | Employee profile foundation | Persisted evolution/skill/memory records, aggregate API, seven-view responsive UI, and existing-Bot backfill | Every UI entry opens the same employee; full repository check and browser QA pass |
| 3:15–4:30 | Complete | Safe template export | Strict package schema, preview, sensitive-text blocker, checksum, and JSON download | Default package has no source id, secret, session, approval, Node identity, memory, history, or authority |
| 4:30–5:45 | Complete | Import inspection and quarantine | Upload/parse boundary, schema and checksum validation, compatibility report, and review-only preview | Invalid/unknown fields fail closed; no Bot, skill, memory, or authority is created during preview |
| 5:45–6:45 | Complete | Contributor skill interfaces | Minimal versioned skill create/verify/suspend APIs with immutable evolution events | Verification requires evidence or explicit Owner review; skill state never changes host policy |
| 6:45–7:45 | Complete | Cross-platform conformance hardening | Provider/Node fixture matrix, routing negatives, reconnect tests, and documented support levels | Exact capability majors are checked at both ends; unsupported platforms and versions remain blocked without fallback |
| 7:45–8:30 | Active | Memory safety and contribution handoff | Owner memory lifecycle, full checks, API/docs/roadmap updates, issue-ready follow-ups, and small reviewable commits | Stale or secret-bearing writes fail closed; deletion retains no content; `npm run check` passes; docs distinguish implemented, experimental, and planned behavior |

## Execution rules

1. Keep the Server authoritative for Employee identity, policy, audit, and routing.
2. Treat a Worker Host capability claim as metadata, never as permission.
3. Keep export, local clone, and ownership transfer as separate operations.
4. Parse portable packages with strict schemas and verify integrity before displaying their content.
5. Import preview is read-only. Activation is a separate explicit Owner-reviewed command bound to
   the reviewed package id and digest.
6. Imported skills start disabled and cannot bind a Worker Host automatically.
7. Never export credentials, sessions, cookies, Node identity, leases, approvals, private memory,
   raw screenshots, or machine-local paths by default.
8. Show structured observations and decision summaries, not hidden model chain-of-thought.
9. Finish each slice with focused tests, a full check where practical, updated docs, and one small
   commit.
10. Preserve unrelated user files and uncommitted work.
11. Before each non-trivial slice, research maintained open-source implementations, record the
    selected version and license, and reuse a standard/dependency/adapter before implementing a
    documented gap. Follow [the reuse policy](OPEN_SOURCE_REUSE.md).

## After the first 8 hours

The next order is:

1. package-family updates and registry distribution;
2. memory retrieval, retention, autonomous proposal review, redaction, and selective portable memory;
3. single-use capability leases after approval;
4. Windows, macOS, and Linux native Provider conformance;
5. native keyring/KMS and public publisher-trust adapters;
6. selective local cloning and authenticated ownership transfer;
7. optional office visualization plugin after the core channel workflow is mature.

## Contribution lanes

Contributors can work independently on protocol fixtures, Provider adapters, employee package
validation, profile accessibility, translations, security review, and documentation. Each pull
request must state its supported platform, security boundary, test evidence, and whether the feature
is implemented, experimental, or planned.
