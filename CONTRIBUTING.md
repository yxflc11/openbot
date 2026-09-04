# Contributing to OpenBot

Thank you for helping build OpenBot. The project is in pre-alpha, so small changes with explicit
acceptance criteria are more valuable than broad rewrites. Before starting a large feature, open an
issue that identifies the milestone, user outcome, and security boundary it advances.

English is the canonical language for source code, comments, issues, pull requests, and project
documentation. Translations are welcome and should remain faithful to the English source.

[简体中文贡献指南](CONTRIBUTING.zh-CN.md)

## Contribution priorities

OpenBot currently reviews contributions in this order:

1. reproducible bugs, data loss, and security hardening;
2. Windows, macOS, and Linux compatibility with real-device evidence;
3. reliability, recovery, observability, and fail-closed behavior;
4. small product journeys already present in the roadmap;
5. documentation, accessibility evidence, and faithful translations;
6. broad new subsystems only after issue-level design agreement.

Start with the [contributor work packages](docs/CONTRIBUTOR_TASKS.md) if you want a bounded task with
acceptance criteria.

## Find an area to contribute

| Interest | Main paths |
| --- | --- |
| Product and mobile UX | `apps/web`, `docs/INTERFACE.md` |
| Control plane and realtime | `apps/server`, `packages/db` |
| Node protocol and reliability | `apps/node`, `packages/protocol` |
| Computer integrations | `providers/*`, `packages/provider-sdk` |
| Policy and security | `packages/policy`, `docs/SECURITY.md` |
| Documentation and translations | `README*.md`, `docs/`, ADRs |
| Optional experiences | `packages/office-plugin` and future plugins |

Use an existing issue when possible. For new work, choose the bug or feature template so the
expected behavior, milestone, and permission boundary are recorded before implementation.

| Situation | Start here | Evidence expected |
| --- | --- | --- |
| Reproducible defect | Bug report | Actual/expected behavior, minimal reproduction, sanitized environment |
| Product or architecture change | Feature request | Acceptance journey, upstream review, permission boundary |
| New runtime or computer integration | Provider integration | Pinned upstream, exact capabilities, negative tests, target-platform evidence |
| Security vulnerability | Private Security Advisory | Impact and minimal safe reproduction; never use a public issue |
| Setup question without a defect | Existing docs and Discussions when enabled | Do not create a product bug without reproducible behavior |

## Local development

Requirements: Node.js 22+, npm 10+, and Docker with Docker Compose.

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
cp .env.example .env
```

Replace `OPENBOT_OWNER_PASSWORD` and `OPENBOT_NODE_TOKEN` in `.env`, then run:

```bash
npm install
npm run db:up
npm run dev
```

The Server listens on port `3001` and the Web app on port `5173` by default. The Node connects to
the Server over WebSocket. It advertises no execution capability unless a compatible provider is
configured.

Before opening a pull request:

```bash
npm run check
npm audit
```

Run `npm run db:stop` when the development database is no longer needed.

## Engineering principles

- Research maintained GitHub repositories and open standards before designing any non-trivial
  feature. Create a durable issue, ADR, or [feature research record](docs/research/README.md) before
  implementation and record the queries, comparison, selected version, license, and decision.
- Prefer, in order: an open standard, a released dependency, a thin pinned adapter, an upstream
  contribution, a narrow fork, and finally a documented local gap implementation.
- Preserve one Server-owned source of truth for tasks, approvals, and audit events.
- Prefer adapters over forks and upstream fixes over long-lived local patches.
- Treat models, webpages, skills, inbound messages, and execution environments as untrusted.
- Add no capability without a default-deny behavior, failure mode, and verification plan.
- Keep network waits outside database transactions.
- Make state transitions conditional and idempotent where concurrent workers can race.
- Never commit credentials, cookies, private transcripts, secret-bearing screenshots, or real user
  data.
- Keep product claims aligned with executable tests and the current implementation.

The root [repository instructions](AGENTS.md) apply equally to human and automated contributors.
When expanding old code, locate its entry in the
[retroactive reuse ledger](docs/OPEN_SOURCE_REUSE.md) first; an absent or partial entry must be
reviewed before expansion.

## Code and comments

- Prefer names, types, and small functions that make the normal path self-explanatory.
- Write comments in English and use them to explain **why**: security boundaries, concurrency
  invariants, protocol ordering, rollback behavior, or a non-obvious upstream constraint.
- Do not narrate syntax, restate the next line, preserve dead code, or leave unowned TODO comments.
- Public provider and protocol contracts should document guarantees that an external contributor
  cannot infer from the type alone.
- Update or remove a comment in the same pull request when its invariant changes.

## Documentation and translations

`README.md` is the canonical English README. Each maintained `README.<locale>.md` should preserve:

- the pre-alpha warning and security limitations;
- the distinction between available and planned capabilities;
- the quick-start commands and configuration names;
- the roadmap and contribution entry points.

Do not add large architecture screenshots or generated diagrams to a README. Prefer a compact text
flow, a table, and links to focused documents under `docs/`. A translation-only pull request is a
valid contribution; identify the language and reviewer strategy in its description.

## Security-sensitive changes

A change that touches permissions, computer control, credentials, networking, sandboxing, Node
identity, or approval behavior must include:

- a threat or failure scenario;
- a fail-closed test;
- an audit-event expectation;
- documentation of every new privilege;
- the pinned upstream version or contract it depends on.

Never weaken an approval or identity boundary only to make a demo pass. Report vulnerabilities
through the private process in [SECURITY.md](SECURITY.md), not a public issue.

## Pull requests

1. Fork the repository and create a focused branch such as `fix/dialog-focus` or
   `feat/windows-provider`.
2. Keep one pull request focused on one acceptance journey and link the issue it closes or relates
   to.
3. Add tests at the lowest useful boundary and an integration test for cross-component behavior.
4. Run `npm run check`; record any real-device, browser, or assistive-technology evidence.
5. Update docs and existing translations when user-visible behavior or project claims change.
6. Complete every applicable section of the pull request template.
7. Preserve upstream copyright and license notices.
8. Link the upstream research note and state whether source was copied or substantially adapted.
9. Disclose AI or automation assistance and identify what a human verified; generated output is not
   acceptance evidence by itself.

All new source files are contributed under the repository's MIT license unless a directory contains
a more specific upstream notice.
