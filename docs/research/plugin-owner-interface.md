# Research: Owner interface for MCP tool plugins

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: OpenBot contributors
- Acceptance journey: Owner inspects an exact tool declaration, installs it disabled, grants tools to a Bot, and sees the precise pending external call before deciding.
- Security boundary: Renderer displays escaped text and calls fixed authenticated management APIs. It does not load plugin JavaScript/HTML, infer authority from annotations, or call plugin endpoints directly.

## Search evidence

- Reviewed [MCP tools specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) and its approval/annotation trust model.
- Reused the release, GitHub source, tests, issues and security review in [third-party plugin research](third-party-mcp-plugins.md): official SDK 1.30.0 at `2d889f2b329e46680ec9bdd565de4616c497825a`, MCP 2025-11-25 compatibility line.
- UI standards and existing React 19.2.8 review: [collaboration presentation research](channel-collaboration-presentation.md). Native form/select/details controls are the first viable implementation; no additional UI package is needed.
- Existing workspace skill-gallery and native modal/form reuse entries were checked. Tools are deliberately a separate panel from SKILL.md and employee packages.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Native form/disclosure and existing React | React 19.2.8; WAI-ARIA 1.2, 2023-06-06 | MIT; W3C document terms | Existing repository component tests and browser support | Escaped descriptions/JSON, explicit checkboxes and per-tool permission selects | Select standard and existing renderer |
| Plugin-rendered embedded UI | Not adopted | Not applicable | Not required for this task | Would widen renderer execution and trust boundaries | Exclude |

## Reuse decision

- Thin presentation adapter over Server-owned plugin API; no protocol implementation in the renderer.
- Name, endpoint or token edits invalidate preview and review. Installation uses the exact reviewed digest and starts disabled.
- Every tool starts ungranted. Owner explicitly chooses per-call confirmation or ongoing read permission; readOnlyHint never preselects permission.
- Approval views show Bot, endpoint, tool, full JSON arguments and expiration. Missing endpoint, expired record or failed refresh disables decisions. A visible channel polls every two seconds without overlapping reads; hidden/closed views stop or pause.
- User-facing error text does not echo secret or untrusted server payloads. API credentials and pending arguments are not put in URLs or localStorage.
- Unknown completion is surfaced, never automatically retried as a write.

## Source incorporation

- No upstream source copied or substantially adapted. Existing React and stylesheet conventions reused; no new frontend dependency.

## Verification plan

- Preview invalidation on edits; reviewed digest submitted exactly; no automatic grants from annotations.
- Reject/approve payload binding; expired and unavailable calls disabled; own-channel filtering; escaped hostile descriptions/arguments.
- Desktop and narrow viewport synthetic preview; no claim of full third-party service or all-platform certification.
- English/Chinese operational documentation coordinated with backend plugin delivery.

## Unresolved questions

- Public marketplace, OAuth and plugin-rendered resources remain outside this slice.

## Rendered verification on 2026-09-10

Using the synthetic Vite/Chrome setup documented in the collaboration presentation review, 1280 × 900 and 390 × 844 previews showed the installed plugin, add form and permission controls. Opening “Add tool plugin” exposed the connection form. The narrow approval view showed the exact endpoint and full test arguments; choosing “Reject” removed that pending call. No relevant console/page errors or horizontal document overflow occurred. This verifies the renderer and mocked API interaction only; real transport, persistence and authorization are covered by the backend tests. Screenshots remain outside the repository and contain only synthetic data.
