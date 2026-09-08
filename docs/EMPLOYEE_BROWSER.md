# Employee browser

[English](EMPLOYEE_BROWSER.md) · [简体中文](EMPLOYEE_BROWSER.zh-CN.md)

OpenBot's built-in browser is the employee's persistent browser on a Worker Host. Open it from
the employee profile or a browser Run's inspector. The Web client displays the actual remote
page; it does not embed the target website or reuse the Owner's personal browser profile.

## Start the runtime

On the Worker Host, set both values in the repository's `.env`:

```dotenv
OPENBOT_DOCKER_COMPUTER_URL=http://127.0.0.1:4100
OPENBOT_DOCKER_COMPUTER_TOKEN=<a-random-token-of-at-least-16-characters>
OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false
```

Then run:

```bash
npm run browser:up
npm run browser:status
npm run dev:node
```

The Node must already be enrolled; see [Node enrollment](NODE_ENROLLMENT.md). The first browser
start builds CopilotKit/OpenBot at commit `257c1280d684089be9adb0b35cce262efc7064bf` with its
Playwright 1.62.1 image and downloads browser binaries. The build recipe adapts the upstream Dockerfile, pins Bun 1.4.2 and the archive/image digests,
and preserves the upstream license in the image; the installer script and OS package repositories
are not fully reproducible release inputs.
Production packaging must pin those too before claiming a reproducible distribution.

The container exposes only `127.0.0.1:4100`, retains `/profiles` and `/workspace` in named volumes,
and is separate from the Server database network. No Docker socket is mounted in it. Stop with
`npm run browser:stop`; stopping retains profiles. Do not delete volumes to fix a connection error.
The container/profile boundary and upstream sandbox settings are not a certified hostile-code
sandbox. Enforce network egress on the Worker environment for redirects, subresources, and DNS
rebinding; the URL precheck alone covers only explicit navigation. `OPENBOT_BROWSER_EGRESS_PROXY`
can supply an operator-managed policy proxy; merely specifying a proxy does not prove isolation.

## Use the browser

1. Create an employee with **Employee browser · Docker** (`docker-linux`). A model-only employee
   has no browser authority. Start the Server and Web app as described in the root README.
2. Open the employee profile and select **Open browser**, or open it from the Run inspector.
3. The panel refreshes its PNG while visible. Choose **Take control** before navigating or input.
4. Click a field in the page, enter/paste Unicode text in the input bar and select **Input**.
   **Hide** masks the local input bar. Tab, Enter, Backspace, Select all and scroll controls work
   on desktop and touch devices. Input is sent to the focused remote field, not to the model.
5. Choose **Return to employee** when done. Closing the panel while holding control leaves the
   employee paused. Reopen, take control, then explicitly return it to resume queued tasks.

Only one viewing window controls an employee at once. The 30-second control lease is renewed by
successful visible-panel observations, with expiry checked by Server and Node. Backgrounding or
losing the connection can expire input authority; expiry never silently returns the page to the
Agent. A view session expires after ten minutes of inactivity. At most 64 view sessions exist on
the Server; backend commands and responses have separate bounds and deadlines.

The employee remains bound to the Worker used for its browser. If that Worker disappears, reconnect
it rather than silently opening an empty browser on another machine. Profile migration and an
Owner-facing rebind workflow are not included. Login state never enters an employee template.

## Contract and evidence

- `POST /api/v1/bots/:botId/browser` opens an authenticated view session.
- `POST /api/v1/browser-sessions/:sessionId/commands` accepts one strict action: `observe`, `take`,
  `release`, `navigate`, `click`, `type`, `key`, or `scroll`. It returns session/control state and
  one bounded PNG frame. All input requires that exact session's unexpired control grant.
- `DELETE /api/v1/browser-sessions/:sessionId` closes observation; it does not return control.
- API requests require the normal Owner cookie and trusted Origin. Grants are bound to the exact
  Owner login session. Cookies, computer tokens and typed text are not placed in URLs.
- Capability `browser.session@1` gates the additive `browser.command`/`browser.result` exchange over
  the existing authenticated outbound Node socket. Unrelated/late replies are ignored, disconnect
  rejects pending calls, and the Node consumes request IDs before execution.
- Server `run_events` records `BROWSER_OPENED` and content-free `BROWSER_COMMAND` intent/outcome
  events. A failed intent audit prevents input. An uncertain response is never automatically retried.
- PNGs are transient response data, not persisted conversation artifacts. Screenshots can show
  whatever is visible on the employee page; masking the local text field does not redact the page.

See [research](research/employee-browser.md) and [ADR-0028](decisions/0028-employee-browser-sessions.md).
The existing automated Run path still opens an explicit public URL and returns a screenshot.
This feature adds human interaction; it does not claim autonomous multi-step browsing, signed
single-use automated approval leases, video-rate streaming, downloads, full tab management or
general desktop control. Web UI and simulated routing do not certify every Worker operating system.

## Verification on 2026-09-08

`npm run check` passed, including documentation/research/migration checks, lint, types, tests and
production builds. Browser tests cover session ownership, expiry, audit failure, request bounds,
reply correlation, disconnected delivery, replay rejection and serialization with Runs.

A real Server, PostgreSQL and outbound Node were exercised against the pinned Chromium runtime
using synthetic accounts and a local test form. Desktop (1440 × 1100) and mobile (390 × 844) Web
journeys passed: employee profile, browser open, takeover, navigation, pixel click, Unicode/paste,
Tab/Enter form submission, scroll, release and close. There were no browser console errors or
horizontal mobile overflow. A runtime restart with a named profile volume retained form state;
a second employee had independent state. The final image includes the upstream MIT license.
The test database contained content-free browser audit events and no submitted input text.

This evidence uses a macOS host with Docker's Linux ARM64 Chromium runtime. It does not certify
native desktop Providers, every website login flow, browser crashes, or all operating systems.
