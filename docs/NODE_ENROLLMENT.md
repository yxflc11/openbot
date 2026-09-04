# Node enrollment

[English](NODE_ENROLLMENT.md) · [简体中文](NODE_ENROLLMENT.zh-CN.md)

OpenBot Worker Hosts connect outward to the Server. Each Node first exchanges a short-lived,
single-use enrollment token for its own revocable credential. The Server stores only
domain-separated SHA-256 digests of both values.

This is the M1 bootstrap boundary, not a production device-attestation claim. The issued value is
still a bearer credential. Keep the Server and Node on a trusted private network, use `wss:` for
every non-loopback connection, and use a dedicated OS account for the Node.

## Enroll a Node

1. Configure `OPENBOT_OWNER_PASSWORD` and start PostgreSQL and the Server.
2. Sign in to the Web app, open **Nodes** in the sidebar, and create a token for the exact Node id.
   The trusted Server host also exposes the same operation through the CLI:

   ```bash
   npm run node:enrollment-token -- office-linux-01
   ```

3. On the Worker Host, configure the same `OPENBOT_NODE_ID`, its Server WebSocket URL, and the
   printed one-time value:

   ```dotenv
   OPENBOT_NODE_ID=office-linux-01
   OPENBOT_NODE_SERVER_URL=wss://openbot.internal.example/ws/nodes
   OPENBOT_NODE_ENROLLMENT_TOKEN=obenr_...
   ```

4. Start the Node once. It exchanges the token over HTTPS before opening its WebSocket and writes
   `identity.json` under `OPENBOT_NODE_WORK_DIRECTORY` by default.
5. Remove `OPENBOT_NODE_ENROLLMENT_TOKEN` from the environment immediately. Restart the Node to
   confirm that it reconnects with the stored identity.

Enrollment tokens expire after ten minutes by default, are shown once, and cannot be replayed.
Issuing a replacement invalidates the previous unused token for that Node. The credential file is
atomically written with mode `0600` on POSIX systems. OpenBot also refuses to load it if group or
other permission bits later appear; restore an operator-approved file with
`chmod 600 identity.json` before restarting. It refuses symlinks, non-regular files, oversized
files, malformed packages, and credentials issued for another Node id.

The Owner dialog lists active and revoked identities without returning credential digests. Its
online state is reconciled with the live Node connection projection. The pairing token is held only
in the open dialog and cannot be retrieved after it is closed.

For an ephemeral environment, `OPENBOT_NODE_CREDENTIAL` may provide the enrolled credential
directly. Treat this as a secret-injection integration point, not a value to commit or place in an
Employee package. `OPENBOT_NODE_CREDENTIAL_PATH` can move the file to an operator-controlled
secret volume.

## Linux service profiles (experimental)

Linux has two explicit profiles because Secret Service belongs to a user's D-Bus login session; a
machine-wide daemon normally has no such session and must not borrow another user's keyring.

| Profile | Credential boundary | Why use it | Benefit |
| --- | --- | --- | --- |
| Headless system service | `/var/lib/openbot-node/identity.json`, owned by the dedicated `openbot` account with `0600` mode | Servers, VMs, and unattended boot | Predictable boot lifecycle without depending on a desktop login |
| Dedicated desktop user service | Secret Service selected with `OPENBOT_NODE_CREDENTIAL_STORE=secret-service` | A dedicated Linux user that has an active graphical login and unlocked keyring | The bearer identity is kept outside an ordinary configuration file |

The reviewed units are [the system profile](../deploy/node/systemd/openbot-node.service) and
[the user profile](../deploy/node/systemd/openbot-node-user.service). They are contract-tested
deployment assets, not yet a signed installer or a Linux support claim.

For the system profile, put only `OPENBOT_NODE_ID`, `OPENBOT_NODE_SERVER_URL`, and the first-run
`OPENBOT_NODE_ENROLLMENT_TOKEN` in `/etc/openbot/node.env`; the unit enforces file storage and its
state directory. For the user profile, install the distribution's `libsecret-tools` package. The
reviewed Ubuntu 24.04 baseline is `0.21.4-1build3`; do not downgrade a later security update. Put
the same first-run values in
`~/.config/openbot/node.env`, and enable the unit through that dedicated user's `systemctl --user`
manager. The unit enforces Secret Service and never falls back to a file.

After either first start succeeds, remove the enrollment token and restart. A missing
`secret-tool`, absent D-Bus session, locked or denied keyring, timeout, malformed identity, helper
error, or oversized output stops identity setup. OpenBot does not create or automatically unlock a
keyring. Do not run the desktop profile against the Owner's primary login or password collection.

## Verifiable Linux release candidate

The repository can now build a bounded, unsigned x64 or arm64 candidate directory before an
installer is allowed to consume it. This stage exists so an installation script never has to guess
which runtime, dependency set, service file, or source revision it received.

| Gate | Why it runs | Benefit |
| --- | --- | --- |
| Exact Node archive name, size, and SHA-256 | A host-wide or substituted runtime changes the code that executes | The candidate always carries the reviewed Node `22.22.2` Linux runtime for its declared architecture |
| Exact ncc and output inventory | Silent externals or new companion assets can make the package incomplete | Every runtime JavaScript file is allowlisted and build drift stops before staging |
| Production-only SPDX SBOM | A monorepo-wide inventory can include test Providers and hide the actual runtime closure | Operators see the packages that can reach the Node entry point, without test-only workspaces |
| Clean source commit and deterministic source time | Dirty worktrees and wall-clock/random SBOM fields cannot be reproduced | The same reviewed inputs have a stable manifest, SBOM, and checksum set |
| Symlink, path, count, mode, and size bounds | Packaging inputs are still untrusted filesystem data | Traversal and unbounded payloads fail without creating an installable-looking result |

Build all workspaces and stage a candidate with the exact reviewed inputs:

```bash
npm run release:node-linux:candidate -- \
  --arch x64 \
  --node-archive /trusted-inputs/node-v22.22.2-linux-x64.tar.xz \
  --npm-cli /trusted-tools/npm-10.9.8 \
  --out-dir /safe-output \
  --source-commit 0123456789abcdef0123456789abcdef01234567 \
  --source-date-epoch 1788480000 \
  --version 0.1.0
```

The source commit must equal `HEAD`, the worktree must be clean, the output candidate must not
already exist, and the npm executable must report exactly `10.9.8`. The result includes the bundled
app and its allowlisted worker assets, official Node executable and notice, both systemd profiles,
English/Chinese enrollment guidance, SPDX SBOM, `manifest.json`, and `SHA256SUMS`.

The directory name and manifest say `unsigned`. It is not a release, installer, Linux support
claim, or substitute for signature verification. Reproducible `.tar.xz` construction, tag-only
GitHub provenance, install/upgrade/rollback transactions, and real x64/arm64 host evidence remain
required by [ADR-0033](decisions/0033-linux-worker-host-verifiable-archive.md).

## Revoke or replace a Node

An authenticated Owner can call `POST /api/v1/nodes/:nodeId/revoke`. Revocation updates the
persisted credential, appends an identity audit event, and disconnects a matching online Node.
Delete or quarantine the old local credential file after revocation.

To pair the same Node id again, issue a fresh enrollment token and start it without the revoked
credential. A new credential replaces the revoked record, immediately disconnects a session using
the previous credential, and leaves all old values invalid.

## Operational rules

- Never send an enrollment token through a public chat, issue tracker, log collector, or Git.
- Never copy `identity.json` between Node ids or include it in a portable Employee package.
- Treat a POSIX permission refusal as secret exposure to investigate, not only a startup error.
- Back up the Server database securely; it contains credential digests and identity audit events,
  not recoverable plaintext credentials.
- The public exchange is throttled by a domain-separated digest of the direct peer address. An
  `enrolled` audit event stores only that digest and whether it came directly or through the one
  explicitly trusted proxy; it never stores the raw address, token, or credential.
- A lost Node credential is replaced through revocation and fresh enrollment, not recovered.
- Do not infer OS isolation, host ownership, or Provider permission from successful enrollment.
- Keep native desktop Providers disabled until their platform-specific permission review passes.

## Current security limit

Protocol `0.9.0` proves possession of a Node-specific bearer value at connection time and supports
single-Node revocation. Linux now has a contract-tested, explicit Secret Service adapter for a
dedicated login session, but real unlocked/locked keyring and systemd x64/arm64 evidence is still
pending. The protocol does not yet prove possession of a non-exportable private key, rotate a
short-lived certificate, bind every message to a sequence, or use Windows Credential Manager or
macOS Keychain. Those controls remain required before exposing the Node channel to an untrusted
network. See
[ADR-0023](decisions/0023-one-time-node-enrollment.md), the
[permission review](research/posix-node-credential-permissions.md),
[Linux service decision](decisions/0032-linux-worker-host-service-profiles.md), and
[Security](SECURITY.md).
