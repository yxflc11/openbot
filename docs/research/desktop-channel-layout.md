# Research: Desktop channel workspace

- Date: 2026-09-05
- Status: Implemented and visually verified
- Request: retain the reference's left navigation and right information panel; replace its office
  scene with Telegram-style channel conversations. Correct the development shell's app identity.
- Boundary: no office feature, protocol replacement, invented token metrics or fake conversations.

## Candidates and evidence

The existing channel UI is recorded in the open-source reuse ledger. It already provides Server-
owned messages, typed replies, task inspection, approvals and SSE recovery. These remain the data
and authorization boundary; this change reorganizes their presentation.

- Reviewed Telegram Desktop **v6.9.3**, its release page, GPL-3.0 license and
  `Telegram/SourceFiles/history/view/history_view_list_widget.cpp` (scroll/history behavior), plus
  current GitHub open issues. Search: `site.github.com/telegramdesktop/tdesktop releases`,
  `WAI ARIA search landmark log chat`. The C++/Qt application is maintained but is not a compatible
  runtime dependency for the existing React/Electron client. No source or assets are copied.
  Only familiar messaging conventions are used: a channel list, compact identity header,
  distinct incoming/outgoing messages, and a persistent composer.
- Reuse **React 19.2.8**, existing component state and native HTML forms/landmarks. W3C APG
  search landmark and WCAG 2.2 ARIA23 chat-log guidance are the first viable open standards.
  Local filtering needs no search service, index dependency or protocol change. Search runs on
  already authorized channel/Bot names and descriptions only.
- Electron **44.2.0**, existing CSS and existing icon remain the platform/layout boundary.
  Native traffic lights retain their reserved draggable area. Each column scrolls independently.
  On the minimum native window width (960px), all three columns remain visible.

Sources:
- https://github.com/telegramdesktop/tdesktop/releases/tag/v6.9.3
- https://github.com/telegramdesktop/tdesktop/blob/v6.9.3/Telegram/SourceFiles/history/view/history_view_list_widget.cpp
- https://github.com/telegramdesktop/tdesktop/issues
- https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/search.html
- https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23
- https://react.dev/reference/react/useMemo

## Decision and verification

Use standard HTML and the released dependencies already present. Apply only local React/CSS
adapters; Telegram is a visual interaction reference, not a copied component. Keep the right rail
visible by default, preserve real actions, give empty states actionable copy, and never seed fake
conversations into the user's profile. Render test fixtures only in isolated QA.

Verify channel search, selection, sender selection, composing/replies, long content, keyboard
focus, minimum-window layout, empty/populated states and existing API boundaries. Run the required
repository check and visually inspect the packaged preview independently of the installed app.

## Observed verification

Built-renderer QA at 1440×960, 960×640 and 390×844 passed without horizontal overflow
or page errors. Search (including empty matches), reply, submit, and populated/empty workspaces
were exercised using isolated fixture responses. The native minimum retains all three columns.
Existing messages and execution APIs are unchanged.

Final `npm run check` passed, including 59 Web tests and 135 Desktop tests plus Server/Node
checks and production builds. The native `<search>` landmark meets the repository lint policy;
jsdom emits an unknown-element warning because its DOM implementation lacks that newer element.
Production Chromium visual checks report no page errors.
