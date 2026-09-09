# Research: Exact historical credential-scan fixture triage

- Status: Accepted
- Date: 2026-09-08
- Owner: @yxflc11
- Related issue: CI run `34207930929`, security job on main `979c989`.
- Acceptance journey: Complete Git history remains scanned; one reviewed synthetic URL fixture
  does not block unrelated builds, while every other finding or scanner failure blocks CI.
- Security boundary: No credential verification, result upload, history rewrite, detector exclusion,
  or whole-file exclusion. Candidate values stay in temporary runner files and never enter logs.

## Search evidence

- GitHub queries: `trufflesecurity/trufflehog exclude findings false positive git history allowlist`.
- Reviewed [TruffleHog source](https://github.com/trufflesecurity/trufflehog/tree/20652fbbdefffcdaa493a5bf57ab2ac6b1db715b),
  especially `main.go`, `pkg/sources/git/git.go`, URI detector and Git parser tests;
  [upstream ignore guidance](https://github.com/trufflesecurity/trufflehog/blob/20652fbbdefffcdaa493a5bf57ab2ac6b1db715b/PreCommit.md),
  and [path exclusion issue #420](https://github.com/trufflesecurity/trufflehog/issues/420).
- Existing review: [DEV-001 hardening](dev-001-short-term-hardening.md), CI dependency and secret
  scanning entry in [reuse ledger](../OPEN_SOURCE_REUSE.md).
- Reproduction: the exact pinned image returned 0 for main-only history and 183 after fetching all
  remote branches as CI does. There was one URI finding in `apps/server/src/model-web-tools.test.ts`,
  line 188, commit `9cc73c9e78451e572f57d142d6b9caf62ccb78e2`. The source deliberately rejects
  a URL with synthetic username/password on reserved `example.com`; it is not an account credential.
  Both candidate fields have SHA-256 `1231625e7e70c4e56347672932d37a1c35eff89051483b37cbd09f7b9c58337e`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Existing TruffleHog plus JSON adapter | `3.97.1`, `20652fbbdefffcdaa493a5bf57ab2ac6b1db715b`; existing image digest retained | AGPL-3.0 external tool | Existing reviewed release, source and detector/parser tests; local real scan reproduced | JSON exposes commit/path/line, detector, verification and exact candidate; exit 1 takes precedence over findings exit 183 | Select thin adapter |
| Native path/detector exclusion | Same pin | AGPL-3.0 | Documented CLI flags and source | Would exempt other values in the file or detector | Reject broad exclusion |
| Inline ignore or editing current fixture | Same pin | AGPL-3.0 | Upstream documents inline ignores | Cannot annotate an immutable historical line without rewriting published history | Insufficient for this historical finding |
| Gitleaks replacement | `v8.27.2`, `c7acf33`, already reviewed in DEV-001 | MIT | Maintained static alternative | Would change the existing detector coverage to solve one known false positive | Retain as reserve |

## Reuse decision

- Selected: reuse the pinned TruffleHog JSON output and exit contract through a small Node adapter.
- Exact local gap: accept only the reviewed combination of immutable commit, path, line, URI
  detector ID/name, unverified state, and SHA-256 of both raw candidate fields. Do not exempt any
  other commit, path, detector, candidate, or verified finding.
- Keep scanning all fetched history. Require exit 0 with no findings or 183 with findings; reject
  scanner errors, invalid JSON, malformed findings, oversized output and inconsistent exit/results.
- No dependency, scanner source copy, or substantial adaptation. The external scanner is neither
  linked nor shipped; its existing license treatment is unchanged.
- Replace the adapter with an upstream exact historical finding mechanism if one becomes viable.

## Verification plan

- Negative tests for changed commit/path/line/detector/value, verified findings, mixed findings,
  malformed/oversized output, scanner errors and inconsistent exit codes; never print candidates.
- Workflow regression tests retain full-history, read-only, digest-pinned scanning and require the
  JSON adapter without failure bypasses. Run `npm run check` and replay actual full-history output.
- GitHub-hosted CI provides the final Linux runner evidence; local Docker on macOS only proves
  the pinned scanner and adapter behavior on that environment.
