# Portable employee model

[English](EMPLOYEE.md) · [简体中文](EMPLOYEE.zh-CN.md)

## Product decision

An OpenBot Bot is a portable digital employee, not a chat preset and not the computer that runs
it. The employee owns a persistent identity, role, policies, learned skills, selected memories,
work history, and visual configuration. A Worker Host supplies temporary computer capabilities.

This separation gives the product three independent objects:

```text
Employee       persistent identity, growth, skills, memory, policy
Worker Host    replaceable Windows, macOS, Linux, VM, container, or managed device
Run            one auditable assignment of an Employee to a Worker Host
```

Replacing a computer must not replace the employee. Copying an employee must not silently copy
the source owner's accounts, credentials, approvals, or device authority.

## Employee profile

Selecting an employee opens a durable profile with seven views.

| View | Purpose | Source of truth |
| --- | --- | --- |
| Overview | Name, role, description, appearance, model policy, status, assigned host, and trust boundaries | Employee configuration |
| Evolution | Chronological, evidence-backed record of meaningful capability changes | Immutable evolution events |
| Skills | Graph of acquired skills, prerequisites, provenance, version, confidence, and verification state | Versioned skill records |
| Live work | Current Run stage, tools in use, evidence, next action, approvals, and concise decision summaries | Structured Run events |
| Memory | Owner-visible working, episodic, semantic, and procedural memories with retention controls | Memory records and policy |
| Records | Runs, messages, artifacts, approvals, failures, evaluations, and audit references | Existing control-plane records |
| Configuration | Role, model/provider preferences, capability policy, host binding, schedules, and export controls | Versioned employee configuration |

The first profile release should be a normal product page, not the deferred office visualization.
The avatar opens the profile from the channel roster, message author, and Bot list.

## Evolution is evidence, not gamification

An evolution event records a real change to the employee:

- a skill was installed, learned, verified, upgraded, suspended, or removed;
- a policy or role changed;
- a memory was promoted into a reusable procedure;
- an evaluation score crossed a declared threshold;
- a human explicitly certified or revoked a capability.

Each event stores an actor, timestamp, reason, evidence references, previous and new versions, and
whether the change was automatic or approved. Cosmetic levels and badges may summarize the record,
but they cannot grant execution authority.

## Skill graph

A skill is a versioned capability description with explicit provenance:

```text
Skill
├── stable id and semantic version
├── name, description, inputs, outputs, and required capabilities
├── prerequisites and related skills
├── source: built-in / installed / learned / imported
├── evidence: successful Runs, evaluations, and human verification
├── state: candidate / verified / suspended / revoked
└── policy: allowed hosts, risk ceiling, and approval requirements
```

Learning creates a `candidate` skill. It becomes `verified` only after deterministic validation or
human review. Skill confidence can influence recommendations, but routing and authorization still
use explicit Server policy.

## Visible runtime reasoning

The UI must show an auditable **decision trace**, not private model chain-of-thought. A trace may
contain:

- the current stage and goal;
- evidence or observations used;
- a concise explanation of the chosen action;
- the next intended action;
- uncertainty, blockers, and approval requirements;
- tool calls and their structured outcomes.

Raw hidden reasoning, provider-internal tokens, secrets, and credentials are never required for
the feature. This keeps the interface useful across model providers and avoids presenting verbose
internal text as reliable audit evidence.

## Memory boundaries

Memory is split by purpose and portability:

| Class | Example | Default export |
| --- | --- | --- |
| Working | Current task scratch state | Never |
| Episodic | A completed interaction or Run summary | Excluded |
| Semantic | Stable facts approved for future work | Owner selects |
| Procedural | Reusable instructions and learned routines | Included when licensed and verified |
| Secret reference | Credential or vault reference | Never |

Every memory has provenance, scope, sensitivity, retention, and deletion metadata. Imported content
is quarantined until the owner reviews its source and requested capabilities.

## Copy, export, and transfer

OpenBot supports three different operations. They must not share one ambiguous “clone” button.

| Operation | Result | Identity rule |
| --- | --- | --- |
| Export template | Reusable role, appearance, policies, and selected verified skills | Creates a new employee on import |
| Clone employee | Local duplicate with owner-selected, sanitized experience | Always receives a new employee id |
| Transfer employee | Ownership handoff of an employee package and selected history | Revokes source access before activation |

The portable package is a versioned, signed archive containing a manifest, profile, skill records,
approved memory, appearance assets, compatibility requirements, licenses, and checksums. It excludes
credentials, cookies, session tokens, Node identities, capability leases, raw screenshots, private
audit events, and local filesystem paths by default.

Import always shows a preview:

1. verify signature, checksums, schema version, and licenses;
2. list included memories, skills, assets, and requested capabilities;
3. highlight missing providers and incompatible platforms;
4. let the owner remove optional data;
5. assign a new local identity unless this is an authenticated transfer;
6. keep all imported skills disabled until policy validation finishes.

An employee package carries knowledge and configuration. It never carries authority to a computer.
The receiving owner must explicitly bind it to a Worker Host and grant a local policy profile.

## Data ownership and deletion

- The Server remains the source of truth for employee identity and history.
- Worker Hosts receive only Run-scoped context and short-lived capabilities.
- Owners can inspect, export, redact, and delete employee-owned data by category.
- Audit records needed to explain security decisions are retained separately from portable memory.
- Shared skills preserve authorship, source URL, license, and integrity metadata.
- Transfer and deletion are explicit lifecycle events and cannot be inferred from file download.

## Delivery slices

1. **Profile foundation:** overview, configuration, Run history, and existing artifacts.
2. **Evolution ledger:** append-only events generated from existing Bot, Run, and skill changes.
3. **Skill registry:** versioned records and a read-only dependency graph.
4. **Memory controls:** typed memories, retention, sensitivity, search, and deletion.
5. **Portable templates:** safe export/import without private memory or authority.
6. **Selective clones:** owner-reviewed memories and local re-identification.
7. **Authenticated transfer:** signed ownership handoff, source revocation, and import receipts.

## Current implementation status

Implemented on the `feat/cross-platform-employees` development line:

- a persisted employee evolution ledger, versioned skill registry, dependency graph, and typed memory
  storage;
- an authenticated `GET /api/v1/bots/:botId/profile` aggregate projection;
- automatic creation events for new employees and a safe backfill for existing Bots;
- a responsive seven-view employee profile opened from the Bot list, channel roster, and message
  authors;
- structured Run progress presented as decision summaries rather than private chain-of-thought;
- an authenticated export preview and checksum-protected JSON template containing only role,
  appearance, execution preference, and verified skills;
- structural exclusion of identity, authority, memory, and work history, plus blocking checks for
  credential-like text, private keys, and user-specific local paths;
- a 1 MiB-bounded, strict-schema import inspection endpoint and UI that validate checksum, skill
  dependency/capability consistency, sensitive text, and connected Worker Host compatibility;
- a read-only quarantine projection that cannot create an Employee, activate a skill, persist
  memory, bind a host, or grant authority.

The current v1 template is deliberately unsigned and memory-free. The skill learning/verification
workflow, memory editing and retention controls, signed archive, reviewed import activation,
cloning, and authenticated ownership transfer are not implemented yet. Their data and authority
boundaries are defined here so contributors can add them without coupling employee knowledge to
Worker Host access.

## Acceptance criteria

- Clicking a Bot anywhere in the core UI opens the same employee profile.
- The profile can explain every displayed skill and evolution event with evidence.
- Live work shows structured progress and decision summaries without exposing secrets.
- Exporting a default template contains no credential, session, lease, Node identity, or private
  memory.
- Importing on a machine without the required Provider remains safe and clearly blocked.
- A copied employee cannot operate any Worker Host until the receiving owner grants local authority.
- Deleting an employee follows an explicit retention policy and does not silently corrupt audits.
