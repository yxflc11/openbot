# Desktop setup

[简体中文](DESKTOP_ONBOARDING.zh-CN.md)

The macOS source-build preview offers two choices:

- **Service computer:** Desktop initializes an app-owned PostgreSQL 17 database, starts the
  bundled Server, creates its private Owner bootstrap identity, connects and opens model setup.
  No Docker, Homebrew, administrator account or first-launch download is required.
- **Remote client:** Desktop saves and verifies an existing HTTPS Server origin, then asks for
  its Owner login. It does not initialize or start a local database or Server.

The macOS window uses native traffic lights inside the content area. The application and in-app
branding share one icon. Settings contains model access, connection, device management and role
selection. The running-status rail can be expanded from the sidebar.

## Current boundaries

This is a source-build preview, not a signed/notarized public installer. Native installation has
been exercised on macOS arm64. The x64 package is pinned but has not been exercised on Intel;
Windows and Linux retain remote-client behavior and have no native installer in this change.

The bundled Server currently listens **only on this Mac**. Sharing this native installation with
another computer requires a future authenticated HTTPS provisioning flow. Do not enter its
loopback address on another computer. For remote use today, connect to an existing HTTPS deployment
using the advanced instructions below. Closing the macOS window keeps Desktop running; quitting
Desktop stops its own Server and database. Reopening restarts the same data. This is not a login
service, backup, database-upgrade or unattended-recovery implementation.

Data lives under Desktop's user-data directory in `openbot/local-server`. Secrets are sealed with
Electron safeStorage on macOS; database access uses private random credentials and SCRAM. Model
keys are encrypted by the Server with AES-256-GCM. No secret is returned by the model summary API.
Missing resources, inaccessible Keychain, unsafe data paths or incompatible existing database
state fail visibly; retry does not delete an existing cluster. Switching to remote-client mode
stops local services and retains their data. Switching back reuses that data.

## Model access

After native installation, choose OpenAI or Anthropic and enter an accessible model ID and API key.
Validation requests only model metadata from the selected provider's official HTTPS endpoint;
no generation or transcript is sent. Keys can be replaced in Settings. Concurrent or stale saves
reject instead of overwriting a newer revision. Skipping postpones configuration until Settings
(or the next startup). There is no custom proxy URL in this initial UI.

This stores and validates the workspace default; it does **not** add an agent inference loop or
make an unsupported provider functional. Existing task-execution capabilities remain unchanged.
Remote clients cannot configure older Servers that do not implement the endpoint.

## Build and advanced self-deployment

From the repository root, install locked dependencies, run `npm run check`, then run
`npm run package --workspace @openbot/desktop` on macOS. Packaging stages the compiled Server,
production dependency closure, PostgreSQL binaries and notices in `native-runtime` before
assembling the application. The generated runtime is ignored by Git. A local development launch
also needs `npm run prepare:native --workspace @openbot/desktop` before `npm start --workspace
@openbot/desktop`. First launch does not download executable code.

Advanced users can install Server, PostgreSQL, Web and Worker components separately using the
[root source setup](../README.md#development). These options belong in repository documentation,
not in the initial Desktop role selector. Configure a trusted HTTPS reverse proxy for remote use;
keep database credentials and Owner authentication server-side.

To enable model settings on a separately deployed Server, set both
`OPENBOT_MODEL_SETTINGS_PATH` (an absolute path in a private persistent directory) and
`OPENBOT_MODEL_ENCRYPTION_KEY` (64 lowercase hexadecimal characters representing 32 random bytes).
Keep the encryption key in a secret manager outside the settings file; losing it makes saved keys
unreadable. Omit both to disable the endpoint. Run one Server writer per settings file. The API is
Owner-only `GET`/`POST /api/v1/settings/model`, with the existing mutation-origin checks; POST
requires `provider`, `model`, `apiKey`, and the last `revision` (null for initial configuration).

The native PostgreSQL package is pinned to `17.10.0-beta.17`. Its prerelease packaging, upstream
binary provenance, distribution notices, signing and notarization must be reviewed before a
public release; local functional tests alone are not a distribution-support claim.
