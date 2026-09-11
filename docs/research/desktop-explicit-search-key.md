# Explicit Desktop search credentials

- Status: accepted; 2026-09-11. Scope: DEV-002 N3.
- Existing reuse entry: Desktop public web tools in `OPEN_SOURCE_REUSE.md` and
  `research/desktop-public-web-tools.md`. The underlying search adapter and authority are unchanged.
- Observed gap: `NativeServerController` forwarded a generic parent-process `TAVILY_API_KEY`
  automatically, potentially selecting another application's account for Desktop searches.

## Evidence and decision

Reviewed Electron **44.2.0**, its installed utility-process declarations, the
[versioned process API](https://github.com/electron/electron/blob/v44.2.0/docs/api/utility-process.md),
and the [OWASP secret-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
on 2026-09-11. GitHub searches: `electron/electron utilityProcess fork env documentation`;
standards search: `OWASP Secrets Management environment variables`.

The existing process API accepts an explicit environment map. Reuse that standard API and the
current small allowlist: only `OPENBOT_DESKTOP_TAVILY_API_KEY` is mapped to the owned Server's
`TAVILY_API_KEY`. A generic Tavily key alone is ignored. Standalone Server configuration and stored
model settings are unchanged. There is no new dependency, copied upstream source, secret store,
renderer credential access, or claim to remove all environment-secret risks. Electron's MIT
license/notice already ships with Desktop. A new credential library would not solve selection of
the correct account at this process boundary and is unnecessary for this gap.

## Verification

Check generic-key contamination, an explicitly selected Desktop key, empty/whitespace values,
and absence of unrelated credentials or configuration from the returned map. Run repository
checks. This is explicit launcher configuration, not a new user-interface or keychain feature.
