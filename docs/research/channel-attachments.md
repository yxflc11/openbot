# Research: Persistent channel attachments and scoped model reading

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: @yxflc11
- Related issue: Core collaboration and plugin milestone
- Acceptance journey: Select multiple files, upload them to the current channel, submit short immutable references, and let the assigned Bot read text in bounded pages or receive supported image/PDF model parts.
- Security boundary: Owner-authenticated Server routes and current channel scope; immutable random storage identities; no filesystem paths, external URLs, execution, archive extraction or model-created attachment authority.

## Search evidence

- Search date: 2026-09-10.
- GitHub queries: `honojs/hono v4.13.5 body-limit`, `vercel/ai 7.0.93 PDF`, `repo:vercel/ai is:issue is:open pdf`.
- Primary documentation: [Hono body limit](https://hono.dev/docs/middleware/builtin/body-limit), [AI SDK model messages](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message), [AI SDK prompts](https://ai-sdk.dev/docs/foundations/prompts), [Claude PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support), [OWASP file uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- Inspected installed pinned Hono body limiter and AI SDK OpenAI/Anthropic converters; verified upstream prompt conversion tests, Hono middleware tests, tags and open issues through GitHub API. AI SDK #11918 concerns file_id compatibility and #15147 records provider request-size constraints. Do not use external file URLs or claim arbitrary compatible endpoints support binary input.
- Existing ledger: Approved Desktop UI refresh, native Agent loop/public sources, atomic sensitive files and artifact read integrity. This review replaces the old 3 × 6,000-byte inline-only attachment boundary for newly uploaded attachments; old drafts remain readable.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| HTTP binary body + Hono | 4.13.5 / 06880c4a2b04de9dd74217f26dd831209b9c01f1 | MIT | Maintained middleware source and index.test.ts; release tag verified | Native raw stream avoids multipart parser dependency; independently count real body bytes even with Content-Length | Select standard and existing adapter |
| AI SDK ModelMessage + existing provider adapters | ai 7.0.93 / 6359fd58fe68eaade096b5d923bac26de84ca3bd; @ai-sdk/openai 4.0.60; @ai-sdk/anthropic 4.0.49 | Apache-2.0 | Prompt conversion tests and installed file/image converters inspected; PDF issues reviewed | Use byte parts, not remote URLs; image/PDF ingestion only through OpenAI/Anthropic, with actual model compatibility still required | Select released dependency |
| Node filesystem/crypto + write-file-atomic | Node production runtime 24.20.0; write-file-atomic 8.0.0 | Node.js license; ISC | Existing atomic write, cancellation and integrity tests; upstream fsync/rename cleanup documented | Random non-executable storage names, digest reads, persistent metadata and quota; same existing object-store root | Select standard and released dependency |
| Local PDF parsing / OCR / archive extraction | Not introduced | N/A | No additional parser reviewed or installed | Provider-supported PDF parts close the present task; local parsing adds an unnecessary active-content/CPU surface | Out of scope |

## Reuse decision

Use raw authenticated upload routes, existing atomic storage primitives and released AI SDK multimodal parts. The OpenBot-specific gap is the binding from a channel-scoped uploaded object to an explicit immutable task reference and a bounded text-read tool. Do not serialize large attachment content into the 8,000-character task instruction.

Text/code formats use strict UTF-8 and a 256 KiB limit; PNG/JPEG use signature checks and a 5 MiB limit; PDF uses a signature check and a 10 MiB limit. A task may reference at most 8 attachments and 20 MiB. Storage has a 256 MiB/1,024-file cap, including orphaned bytes, with serialized writes in the Server process. Bytes and metadata persist across restart. Integrity is verified before model use and download. Attachment text is untrusted data; instructions inside it cannot expand scope. No antivirus, image normalization, PDF decryption or OCR is claimed. Binary input rejection by a provider remains a visible task failure.

The initial Owner task may reference only existing current-channel attachments; delegated runs may inherit only IDs authorized by their parent, enforced by the collaboration service. Tool calls cannot introduce IDs outside this set. Text is returned in explicit pages with offsets/truncation; no claim of complete reading from a partial page.

Upgrade/exit: replace storage behind the channel attachment interface or add a separately reviewed extraction provider. Missing storage, deleted/tampered objects, unsupported media/provider, oversized uploads or stale scope fail closed.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: existing released npm dependencies; no copied upstream source.
- Required notices: existing dependency licenses retained.

## Verification plan

- Storage: restart persistence, byte/digest mismatch, type/signature/UTF-8/size checks, quotas, filename/path rejection and channel isolation.
- Routes: auth supplied by app middleware; independent streamed byte bound; metadata/content scope and safe download headers.
- Agent: forged/unlisted/cross-channel IDs fail, text pagination, byte-only image/PDF parts, unsupported provider fails before generation, per-task total limits.
- Frontend: multiple files, upload errors, concurrent draft changes, cancellation/unmount, short references and legacy draft compatibility.
- Run npm run check. Local mocked model tests establish request construction, not successful real-provider inference. No additional platform-conformance claim.

## Unresolved questions

- Real provider/model inference depends on configured credentials and model capabilities; dense/encrypted PDFs can be rejected even below byte limits.
- Storage cleanup/retention UI and multi-process shared-volume quota locking are separate work. This adapter targets the existing one-Server object-store deployment.
