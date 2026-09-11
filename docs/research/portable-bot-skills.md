# Research: portable Bot instructions

- Status: Accepted for implementation
- Date: 2026-09-11
- Owner: @yxflc11
- Acceptance journey: export an explicitly selected reviewed single-file skill with a Bot, import into a clean workspace, review the exact content and use it under the new Bot identity.
- Security boundary: package content is untrusted; identity, grants, memory and history never transfer. Content is disabled until the recipient reviews its digest.

## Search evidence

Reviewed the Employee export/import and Agent Skills ledger entries, `agent-skills.ts`, the transactional import and DSSE verifier. Queries: GitHub `agentskills/agentskills SKILL.md specification license`; official [specification](https://agentskills.io/specification). Reviewed [pinned specification](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379), Apache-2.0 code and CC-BY-4.0 documentation. Discussion [379](https://github.com/agentskills/agentskills/discussions/379) documents unresolved licensing/attribution conventions: a license identifier alone must not be treated as permission to copy arbitrary referenced files.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Agent Skills SKILL.md | 69ef37e9424c0a7ea9dd2293b559e43ec8176379 | Apache-2.0 code / CC-BY-4.0 docs | Maintained specification and reference validator; existing bounded YAML parser tests | Standard metadata and instruction body, source and license remain in the original file | Reuse standard |
| Existing OpenBot parser, package integrity and transaction | 729c164310570aa0f3bfbb0be671242ee5425ba4 | MIT | Negative parser, stale-preview, signature, quarantine and transaction tests | Preserve content hash and new identity; recipient grants remain independent | Thin adapter |
| Directory/archive transport | No new implementation selected | Not applicable | Existing runtime only supports one bounded instruction file | Scripts/assets introduce execution and path authority beyond this task | Defer unsupported bundle types explicitly |

## Reuse decision

Add `openbot.employee/v2` for optional single-file content and retain v1 readers/default API compatibility. The renderer explicitly selects whether to include reviewed instruction files. Use a matching v2 DSSE payload type; reject mismatched version envelopes. Preserve exact normalized SKILL.md bytes, digest and license metadata, including author/source notices already in the file. Permit a small documented set of redistributable license identifiers; unknown/proprietary/missing licenses require the author to resolve sharing rights before content export. Do not infer ownership from a Bot assignment. No scripts or referenced local assets are fetched or activated.

Reparse included content and verify metadata/digest/declared license at export, preview and activation. Reuse existing runtime constraints: content skills cannot declare external capability/dependency graphs that the native skill reader cannot execute. A metadata-only legacy skill remains visibly metadata-only. Never silently reuse a conflicting local definition with the same slug/version. Keep all imported assignments candidate with no reviewed digest. Bound serialized export so its import request fits the current API limit.

## Source incorporation

No upstream source copied or substantially adapted; no new dependency. Original included instruction text and its notices remain intact. Repository notices unchanged.

## Verification plan

Round-trip real instruction content through a disposable PostgreSQL import, require recipient digest review, inspect native catalog/read result, reject tampering/conflicting definitions and accept old metadata-only v1. Verify browser and Desktop save requests bind content selection into the reviewed bytes. Test DSSE version binding and source secret/path detection. Product documentation and Chinese translation describe the single-file limit.

## Unresolved questions

An arbitrary third-party license or referenced license file cannot be automatically approved. Multi-file skills and cross-tool capability graphs remain unsupported by the current native reader; metadata must not imply they are runnable.
