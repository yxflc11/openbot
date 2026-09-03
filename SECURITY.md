# Security policy

OpenBot is pre-release software that can control computers. Do not connect real payment methods,
production credentials or primary personal accounts.

## Reporting a vulnerability

Please use GitHub's private security advisory flow instead of opening a public issue. Include the
affected commit, a minimal reproduction and the potential impact. Do not include real credentials
or private user data.

The current threat model and approval guarantees are documented in
[`docs/SECURITY.md`](docs/SECURITY.md).

## Dependency audit status

As of 2026-09-03, `npm audit` reports four moderate findings in the development-only
`drizzle-kit -> @esbuild-kit -> esbuild` chain. There are no high or critical findings and this
chain is not included in the Server or Node production runtime. Until Drizzle removes the legacy
loader, do not expose Drizzle Kit or any local development server to an untrusted network. We do
not force-downgrade Drizzle Kit because npm's suggested version is semver-major and incompatible
with the current schema toolchain.
