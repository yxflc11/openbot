# Contributing

OpenBot is currently in foundation stage. Before implementing a large feature, open an issue that names the milestone and the acceptance journey it advances.

## Local development

```bash
npm install
cp .env.example .env
npm run build
npm run test
```

Run `npm run dev` to start the Web, Server and Node workspaces together. The Server listens on port `3001` and the Web app on port `5173` by default.

## Principles

- Preserve one source of truth for tasks, approvals and audit events.
- Prefer adapters over forks and upstream fixes over local patches.
- Treat models, webpages, skills and execution environments as untrusted.
- Add no capability without a deny/default, failure mode and verification plan.
- Never commit credentials, cookies, transcripts, screenshots containing secrets, or real user data.
- Keep product claims aligned with tests on a real Mac Mini.

## Change requirements

A change that touches permissions, computer control, credentials, networking, sandboxing or approval behavior must include:

- a threat/failure scenario;
- a fail-closed test;
- an audit-event expectation;
- documentation of any new privilege;
- the upstream version/contract it depends on.

All new source files are contributed under the repository's MIT license unless a directory contains a more specific upstream notice.
