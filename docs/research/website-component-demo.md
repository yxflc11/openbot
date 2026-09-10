# Research: isolated website component demonstration

- Status: Implementing
- Date: 2026-09-10
- Acceptance journey: replay a synthetic collaboration in the actual product components, interact with replies/reactions/task details, and download the example Markdown result.
- Security boundary: an independent static entry has no Server authority, credentials, model calls, or real workspace. Unknown network requests fail closed. Demo changes last only in memory.

## Search evidence and candidates

Reviewed the existing frontend entries in `docs/OPEN_SOURCE_REUSE.md`, production ChannelWorkspace/Sidebar/API, Vite's production build and relative-base documentation, MDN's EventSource event contract, and GitHub maintained candidates on 2026-09-10.

| Candidate | Version | License | Evidence and fit | Decision |
| --- | --- | --- | --- | --- |
| [Vite](https://github.com/vitejs/vite/releases/tag/v8.2.2) | 8.2.2, de1111a | MIT | Existing locked dependency; released and covered by upstream build/playground tests. [Relative base and HTML input](https://vite.dev/guide/build.html) support a standalone nested static build. | Reuse |
| [MSW](https://github.com/mswjs/msw/releases/tag/v2.15.0) | 2.15.0 | MIT | Maintained API interception library, upstream tests and active issue tracker. Browser service-worker lifecycle is useful for a large mock API but adds a persistent origin-level worker for this small isolated surface. | Not required |
| [EventSource standard browser contract](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) | Living API, accessed 2026-09-10 | Web standard | Existing product subscriber uses named MessageEvents, close and heartbeat; native EventTarget can reproduce this contract without a network connection. | Thin in-memory adapter |

## Reuse decision

Use the existing React 19.2.8 components and Vite 8.2.2 build, with a narrow adapter around the browser Fetch/EventTarget interfaces. The product API is imported unchanged. The gap is synthetic, replayable endpoint responses and event scheduling for one channel; no candidate can supply OpenBot-specific fixtures. The adapter is imported only by demo.html, never the normal or Desktop entry. Content Security Policy blocks connections as an independent backstop; document downloads are intercepted and generated from a fixed synthetic Blob. No service worker or new dependency is installed. Replace the fixture adapter if the actual client API changes; run its contract tests with the normal web suite.

## Source incorporation

No upstream source copied or substantially adapted. Existing OpenBot components are imported directly. Existing dependency notices remain applicable.

## Verification

Deterministic tests cover no-network fallback, unknown/cross-origin endpoints, replay pause/restart, replies, reactions and synthetic downloads. Build/typecheck and actual Chrome interaction at desktop and narrow widths verify integration. This is a product-component demonstration, not evidence of a live model, Server execution, native Grok pixel parity, or Windows runtime conformance. English and Chinese integration instructions accompany the demo.
