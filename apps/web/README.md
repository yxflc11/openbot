# Shared OpenBot client

[简体中文](README.zh-CN.md) · [Repository map](../../docs/REPOSITORY_MAP.md)

This React client is used by both Web and Electron Desktop. `App.tsx` coordinates navigation and authenticated workspace state. Feature components render controlled data and call Server APIs; they do not grant tools, choose authorization or read provider credentials.

`api.ts` is the HTTP/SSE boundary. `conversation-session.ts` owns per-channel draft/send continuity; `run-output-state.ts` projects transient streamed output. `ChannelWorkspace.tsx` composes the transcript/composer; independent message actions, reactions, attachments and plugin panels live in `components`.

Run `npm run dev:web` from the repository root after starting the documented Server. Use `npm run test --workspace @openbot/web` for component/state tests and root `npm run typecheck` for dependency-ordered checks. A UI change also needs actual rendered interaction at wide and narrow widths; JSDOM tests cannot prove pixel layout, focus behavior in Electron or platform media permissions.

Reuse component styles and current tokens. Avoid appending another generation of global overrides to `main.tsx`; legacy global style consolidation is tracked in the [repository audit](../../docs/REPOSITORY_AUDIT.md). The renderer may call only the declared Desktop bridge; native permissions and lifecycle belong in `apps/desktop`. Plugin app content stays behind the existing sandbox/host protocol.
