# Research: September 12 dependency CI repair

- Status: Accepted for integration; full CI remains required before merge
- Date: 2026-09-12
- Owner: @yxflc11
- Related issues: #47, #48, #49, #51; PDF dependency #50 is reviewed separately
- Acceptance journey: Reproduce clean installation, native builds and both Server container architectures on a coherent reviewed dependency graph.
- Security boundary: Keep Server authority, exact Action/image pins, production audits and native assertions; no new application permissions or dependency auto-approval.

## Search evidence

Reviewed existing reuse entries for Desktop delivery, production Server container, Windows Worker CI and attachment processing. Primary GitHub release/tag/source and issue queries on 2026-09-12: `repo:actions/setup-dotnet is:issue is:open v6`, `repo:electron-userland/electron-builder is:issue is:open 26.16.1`, `repo:nodejs/docker-node is:issue is:open 24.21.0`, and `repo:DefinitelyTyped/DefinitelyTyped is:issue is:open "26.5.0"`.

Inspected setup-dotnet's pinned action.yml, package.json, README, src/setup-dotnet.ts and __tests__/setup-dotnet.test.ts; builder's macCodeSign.ts, ElectronFramework.ts, Windows portable tests and license; the published Node type package's index.d.ts, package.json and license; and the official Dockerfile. Upstream suites were inspected, not all executed locally. Existing PR checks show the three tooling updates build successfully; their check job fails because the required research section is absent. The Node container runs the new runtime but its smoke test still requires v24.20.0. These are evidence gaps and incoherent pins, not reasons to remove checks.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| actions/setup-dotnet | 6.0.0 / a98b56852c35b8e3190ac28c8c2271da59106c68 | MIT | Maintained official release, ESM setup and installer tests inspected | Existing node24 action runtime and unchanged input/output contract; hosted Windows runner already passes; exact global.json remains authoritative | Reuse official released Action |
| @types/node | 26.5.0; npm integrity sha512-dVSGpriSoCgz8WnDNTuSSuSv1PC/ALXihO4ulRZt7Md8k9mlbdin3lGOcDE8SnWOgf513ByWlXd7BK4azmyg/A== | MIT and retained Node documentation notices | Published DefinitelyTyped declarations; full project typecheck required | Development declarations only, minimum TS 5.6; existing TS 7.0.2; no runtime upgrade implied | Reuse released type package |
| Official Node Bookworm slim | 24.21.0; docker-node 93a7bafc324a85ac1ee461604cff87cffacb6d7a; OCI sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 | Node license, MIT image source, bundled Debian licenses | Official LTS release and image; two native hosted container health/migration/restart/signal tests required | Same Node 24 LTS/glibc baseline; retain unprivileged user and npm 10.9.9 | Reuse exact official image |
| electron-builder | 26.16.1 / 7d3b30f3b15950d19f7c5ff882cf2d161cd3ba2c | MIT | Maintained v26 backports; signing/license code and portable tests inspected | Same prepackaged DMG/NSIS adapter; release corrects keychain-password usage, retained macOS licenses, misleading Windows signing logs and collector recursion | Reuse released patch |
| Local installer/packager/type fork or unpinned images | None selected | N/A | Duplicates maintained upstream functionality | No gap justifies a fork or weaker pin | Reject |

## Reuse decision

Apply the reviewed Dependabot commits together and fix the contracts they leave stale. Update the exact Docker allowlist, real smoke expected runtime and current bilingual Server container documentation in the same change. The first combined full check also exposed the old setup-dotnet SHA in the strict Windows workflow validator, hidden behind the earlier research failure. Update that exact pin and the negative fixture; continue rejecting moving tags and broadened SDK/cache/artifact settings. Preserve negative tests and digest pinning. Use the package-manager version declared in the repo to regenerate npm locks after combining updates. Review dependency closure and production audit before merging.

The first viable options are the existing released dependencies; the only OpenBot-specific gap is keeping its dependency graph and verification contract synchronized. Revert a complete update if verification fails. No new permissions, viewer scripting, signing certificates or runtime capabilities are introduced.

## Known issues and limits

- setup-dotnet #778 concerns combining stable and preview quality across multiple SDK entries. This workflow selects a single concrete global.json and does not exercise that path.
- No matching open issue was returned for builder 26.16.1, types 26.5.0 or Docker Node 24.21.0 by the recorded narrow searches. This is not proof that no bugs exist.
- A builder signing fix does not sign or notarize OpenBot without actual distribution credentials. Native CI does not replace a human-operated Windows installation acceptance.
- PDF.js graph and text fidelity constraints are recorded in [the separate review](pdfjs-6.3-lock-coherence.md).

## Source incorporation

No source copied or substantially adapted; dependency licenses and packaged notices stay intact.

## Verification plan

Clean npm 10.9.9 installation; exact resolved versions; production audit; full npm run check; current-head security, database, native macOS/Windows/Linux and amd64/arm64 container CI. Publish no release or expanded platform claim from this maintenance batch.

## Primary sources

- https://github.com/actions/setup-dotnet/releases/tag/v6.0.0
- https://github.com/actions/setup-dotnet/tree/a98b56852c35b8e3190ac28c8c2271da59106c68
- https://github.com/electron-userland/electron-builder/releases/tag/electron-builder%4026.16.1
- https://github.com/electron-userland/electron-builder/tree/7d3b30f3b15950d19f7c5ff882cf2d161cd3ba2c
- https://www.npmjs.com/package/@types/node/v/26.5.0
- https://nodejs.org/en/blog/release/v24.21.0
- https://github.com/nodejs/docker-node/tree/93a7bafc324a85ac1ee461604cff87cffacb6d7a/24/bookworm-slim
