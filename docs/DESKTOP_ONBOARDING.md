# Desktop setup

[简体中文](DESKTOP_ONBOARDING.zh-CN.md)

The macOS source-build preview offers two choices:

- **Service computer:** Desktop initializes an app-owned PostgreSQL 17 database, starts the
  bundled Server, creates its private Owner bootstrap identity, connects and opens model setup.
  No Docker, Homebrew, administrator account or first-launch download is required.
- **Remote client:** Desktop saves and verifies an existing HTTPS Server origin, then asks for
  its Owner login. It does not initialize or start a local database or Server.

The macOS window uses native traffic lights inside the content area. The application and in-app
branding share one icon. The left navigation provides New conversation, Automations, Skills,
channels and Bots. Search filters the authorized channel and Bot list. The office scene remains
deferred.

## Workspace navigation and conversations

A shared toolbar aligns navigation with the native window controls. The left side contains the
sidebar toggle and back/forward buttons, the middle identifies the current channel or destination,
and the information-panel toggle stays at the far right. Both side panels start open and can be
hidden independently from the toolbar or Settings; those choices are saved locally. Channel
membership and adding an existing Bot are available from the channel's more menu.

Back and forward revisit channels, Bot profiles, Skills and Automations within the current
workspace. Creating a channel opens it immediately. Returning from Settings preserves the selected
view, channel draft and reading position. Navigation is local presentation state, not a change to
Server routing or permissions. See [navigation research](research/desktop-navigation-continuity.md).

The conversation keeps a shared reading surface, lightweight human-message bubbles and quoted
replies. Task status appears beside its associated message. The rounded composer grows from two
to eight lines, with the receiving Bot selector and send button below the text. Reading older
messages stays in place as new messages arrive; **Return to latest** resumes following the bottom.

Each channel retains its draft text, selected Bot and quoted reply in workspace-session memory.
Switching channels while a send is pending does not move its result into another channel, and a
successful send clears only the unchanged submitted draft. Newer edits are kept. Only one message
submission per channel is pending at a time; failures retain the draft and are not retried
automatically. After an uncertain network result, check the channel history before resubmitting.

Drafts are not saved to disk or localStorage and do not survive logout, changing Owner/Server,
reload or closing the window. The bounded cache retains up to 32 visited channels with drafts of
at most 8,000 characters. Unsent drafts, quoted replies and pending sends are not evicted; if all
slots are in use, the next channel displays a limit notice until an older draft is sent or cleared.
This is not offline sending or Server-side idempotency. See
[conversation research](research/desktop-conversation-continuity.md).

The information panel prioritizes the selected channel's pending approvals, active tasks and
recent results. Workspace totals are available in a disclosure below them. Existing approval and
task-inspection actions retain Server authorization. The Token panel explicitly reports missing
usage because the current Server does not yet produce model measurements; task statistics describe
the recent bounded snapshot, not a daily or all-time total. See
[inspector research](research/desktop-contextual-inspector.md).

macOS sidebar translucency uses Electron's native sidebar material behind the left navigation;
chat and detail surfaces remain opaque. It can be disabled in Settings. macOS Reduce Transparency
or High Contrast overrides the requested effect, and unsupported or unavailable environments use
an opaque fallback. The current workspace has a light appearance; no complete dark appearance or
Liquid Glass implementation is claimed. See [material research](research/desktop-sidebar-material.md).

## Native menus and shortcuts

The macOS application, File, Edit, View and Window menus use Chinese labels. Standard text editing,
zoom, fullscreen and window actions use Electron's native roles. Navigation commands are enabled
only when their corresponding view action is available.

| Action | macOS shortcut |
| --- | --- |
| New conversation | Command+N |
| Open Settings | Command+, |
| Back / Forward | Command+[ / Command+] |
| Show or hide the left sidebar | Command+B |
| Show or hide the information panel | Command+Shift+B |

The same view actions remain available in the interface. No global keyboard shortcut, arbitrary
command bridge, Reload menu or Developer Tools menu is added. See
[native menu research](research/desktop-native-navigation-menu.md).

## Settings and local preferences

Settings has five categories:

| Category | Available controls and information |
| --- | --- |
| General & Appearance | Sidebar translucency, independent left/right-panel visibility, comfortable/compact spacing, 14/16 px chat text, reduced motion, Enter or Command/Ctrl+Enter to send, and 12/24-hour message timestamps |
| Models & API | Read the configured default and validate/save OpenAI or Anthropic model access |
| Server & Work Computers | Current role and Server address, change role or remote connection, open device management, and read local Worker status |
| Privacy & Data | Where data and model credentials are stored, Server authorization boundaries, usage availability, and reset local interface preferences |
| About OpenBot | Application branding, platform/runtime information, supported model-interface choices, and Hermes Agent attribution |

Interface preferences are non-secret values saved in this renderer's local profile, not workspace
policy on the Server. They apply immediately and survive reopening when storage is available.
If saving fails, the current choice remains in memory and Settings explains that it was not saved.
Resetting interface defaults does not delete conversations, Bots, schedules or model credentials.
Changing the Server connection clears Desktop session storage and can reset these preferences.
Shift+Enter always inserts a newline, and IME composition does not send a message. System reduced
motion remains effective even when the local reduced-motion switch is off. See
[preference research](research/desktop-workspace-preferences.md).

## Skills and automatic tasks

Skills indexes actual skill records belonging to Bots in the connected workspace. Search and
state filters lead to the existing Bot skill-review surface. Missing profile reads are shown as
unavailable rather than empty. This is a workspace gallery: it does not download marketplace
packages or activate executable skills. See [destination research](research/workspace-destinations.md).

An authenticated Owner can create an automatic task for a Bot already in a channel, then pause,
resume or delete its schedule. The UI offers elapsed intervals of one hour, 24 hours and seven
days, with a future first-run time entered in the displayed local timezone and stored as a UTC
instant. These are elapsed intervals, not calendar-time promises across daylight-saving changes.
The Server accepts intervals from 15 to 10,080 minutes and a first run within 366 days; there are
at most 50 schedules per Server workspace.

Schedules persist in PostgreSQL and submit a normal channel task through the existing Server
routing, approval and audit path. The Server must keep running; a remote client can be closed.
After downtime, at most one due occurrence is submitted before advancing past the missed
intervals, so there is no backlog replay. An unfinished previous Run skips the next occurrence.
Resuming an expired schedule advances it into the future. At a due check, missing Bot channel membership
pauses its schedule instead of choosing another Bot. Pausing or deleting a schedule stops future
submissions and preserves already-created Runs and history.

A schedule grants no extra permissions and adds no model inference loop or unsupported execution
capability. Submission time is not a guarantee of execution or completion; an eligible Worker and
the existing capability/approval requirements still apply. Older Servers without the automation
API show an unavailable state. This is single-Server operation, not multi-replica dispatch support.
See [recurring-task research](research/server-automations.md).

## Current boundaries

This is a source-build preview, not a signed/notarized public installer. Native installation has
been exercised on macOS arm64. The x64 package is pinned but has not been exercised on Intel;
Windows and Linux retain remote-client behavior and have no native installer in this change.

This interface refinement does not add model-generated replies, input screenshot/file attachments,
task cancellation or automatic/safe retries. Those require separately reviewed Server behavior;
the composer only submits through the existing authenticated text-message API.

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

For an isolated test app, use `npm run package:preview --workspace @openbot/desktop`, then open
`apps/desktop/out/preview/OpenBot Preview-darwin-arm64/OpenBot Preview.app` on Apple Silicon
(substitute `x64` for an Intel build). Finder, Dock, helpers and the app menu use the Preview
identity and the same OpenBot icon. This command packages without launching or copying to
`/Applications`; `npm start` is the Electron development launcher and is not this packaged app.
Preview uses bundle ID `dev.openbot.desktop.preview`, executable `OpenBot Preview`, and its own
`~/Library/Application Support/OpenBot Preview` profile, including cookies and local Server data.
It does not migrate the installed app's data. Rebuilding retains the Preview profile. Preview
cannot include the production macOS Worker companion because its background identity is shared;
the bundled local Server is included. The normal package target keeps its existing identity.

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

Visual checks use isolated fixtures, never seeded data in a real profile. The office scene remains
deferred; this workspace uses channel conversations.
