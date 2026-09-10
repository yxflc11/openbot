# Desktop alpha.6 feature and delivery record

[简体中文](RELEASE_COMPLETION.zh-CN.md)

Candidate: 0.1.0-alpha.6, 2026-09-10. This record describes the source candidate. Native Windows CI, final source publication and public website deployment are release gates still awaiting evidence.

## Workspace and collaboration

| Component | Implemented behavior | Boundary |
| --- | --- | --- |
| Navigation | Search channels/Bots, open direct or group conversations, retain local drafts and reading position | One Owner, not multi-human chat |
| Bot profile | Manage role, description, appearance, execution preferences, reviewed memory and verified skills | Server owns identity and authorization |
| Messages | Quote/reply, rich text, sources, files, timestamp groups and task details | Copy/details are in the side ellipsis menu; actions appear on hover/focus beside the bubble |
| Reactions/members | Owner emoji reactions; add/remove group Bots; removal cancels their active tasks and descendants while retaining history | Direct conversation membership is fixed |
| Native tasks | Model replies, bounded web/source tools, report artifacts, progress and cancellation | Model/provider credentials must be configured; computer control is separate |
| Delegation | A Bot calls another channel member under the recipient's own identity; parent can continue work and join results | Six concurrent roots, two child levels, four descendants, shared five-minute tree budget; no automatic crash replay |
| Live replies | Incremental text appears while the model responds, then is replaced by the formal message | Native adapter support; MiniMax retains its non-streaming path |
| Additional instructions | Append text to a selected queued/running native Run; consume at the next safe model step | Eight total instructions per Run, 4,000 characters each; no rollback of completed actions or implicit propagation to sibling Runs |
| Automations | Create fixed-interval tasks, pause/resume/delete and inspect last outcome; skip overlap | Server must run; changing prompt/timing requires a new automation |

## Files, sharing, settings and extensions

| Component | Implemented behavior | Boundary |
| --- | --- | --- |
| Attachments | Upload/paste/drop supported files, inspect metadata and original downloads; local DOCX/XLSX/PPTX/ODF/PDF extraction, image OCR, password-protected PDF processing | Explicit operations with file, output, time and decompression limits; macros are not executed |
| Voice/media | Record, stop, preview, discard or attach a voice draft; explicitly transcribe supported audio/video | Microphone starts on user action; transcription requires a supported configured provider and can transmit the chosen file |
| File lifecycle | List active files/trash, soft-delete, restore and explicitly clean unreferenced files after seven days | Immutable originals remain available to referencing tasks; no arbitrary file access |
| Downloads | Save produced reports and original attachments through controlled paths | An artifact is offered once on the final matching Bot message |
| Share Bot | Icon entry; preview/export/import reusable role, description, appearance, execution preferences and verified skills | The recipient gets a new identity; private memory, transcripts, credentials, plugin grants and authority are excluded |
| Model/settings | Provider presets, model selection, encrypted credentials, explicit Agent enablement, appearance/navigation/send preferences | Secrets are retained; an OS Keychain trust prompt differs from entering an API key |
| Startup | First initialization uses a preparation flow; later launches reuse stored data and show brief connection status | Never replace unavailable encrypted credentials with a new plaintext identity; unsigned app changes may trigger OS trust prompts |
| MCP tools | Discover/review declarations, per-Bot grants, configured write approvals, revocation and reviewed updates | Update clears old grants; models cannot grant authority |
| MCP resources/prompts | Owner selects material by Bot/channel, previews and inserts into a draft; granted resources can be read in native tasks | Material is untrusted and cannot manufacture reserved attachment references |
| MCP Apps | Official SDK bridge, isolated embedded UI and bounded granted resource access | App tool calls, host navigation, storage, network and device access are not generally enabled |
| Extension contribution | Public protocol, pinned metadata catalog, example and issue template for review | Catalog inclusion is maintainer-reviewed metadata, not automatic installation or trust |

## Website and engineering

The website has English/Chinese product pages, 14 bilingual manuals, search, installation guides and extension documentation. Its interactive demonstration reuses actual Sidebar/ChannelWorkspace components with clearly labeled synthetic data and no model connection. It includes playback, pause/replay, live reply stages and reduced-motion behavior. It does not imitate a product screenshot with generated content or claim pixel equality with every proprietary reference state.

The repository review covers all OpenBot apps, packages, Providers, docs, migrations, packaging and CI. Added module orientation, current architecture, a feature ownership map and explicit PostgreSQL integration suites. Removed obsolete per-message action CSS. Retained unrelated platform code and user data. Larger historical orchestration modules remain documented refactoring candidates, not evidence of a completed wholesale rewrite. See [audit](REPOSITORY_AUDIT.md).

## Verification gates

Local focused tests cover authority, streaming/steering, actual parser/OCR workers, real MCP SDK transport, update revocation, voice lifecycle, retained startup, modal lifecycle and side action interactions. Four isolated PostgreSQL suites exercised 49 cases. Browser checks cover the actual demo, desktop/narrow layouts, plugin SDK isolation and manual search. Tests using synthetic data or mocked media are not real microphone hardware or paid-provider acceptance.

- Pending: full root check after final integration.
- Pending: successful hosted Windows source build, 17.10→17.11 database upgrade, installed native runtime/DPAPI/restart and installer lifecycle.
- Pending: final GitHub source push, Windows-only alpha.6 release and public Pages verification.
