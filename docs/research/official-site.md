# Research: official website and manuals

- Status: Accepted
- Date: 2026-09-10
- Outcome: a public static product site, searchable English/Chinese manuals, plugin protocol and contribution entry, and a Windows download path tied to GitHub releases.
- Boundary: the site has no Owner session, secrets, plugin execution or installation authority. A catalog is reviewed metadata, never permission to connect to an endpoint.

## Candidates and evidence

GitHub/official searches: `withastro/starlight releases i18n`, `vuejs/vitepress releases`, `Starlight custom homepage GitHub Pages`. Reviewed released source, tests, package manifests, licenses and open issues on 2026-09-10:

| Candidate | Pin | Evidence and decision |
| --- | --- | --- |
| Astro + Starlight | Astro 7.2.10, commit 2fdf731428aa738d5dcf3041b4e78eb9d036968c (annotated tag object 9c4d476eacdd5729c2dd566b88621d8dd61cb501); Starlight 0.42.0, commit 88ad3c2630487ba227a7b4ccbffc01a2bdf623a5 | MIT. Maintained public releases. Inspected `packages/starlight/src`, `__tests__/i18n-root-locale`, sidebar/slug/build tests and basic content-loader example. Select released static documentation framework; reuse search, Markdown, localization, navigation and sitemap. Astro supports the repository's Node 22+ / Vite 8 build environment. |
| VitePress | 1.6.4, integrity sha512-+2ym1/+0VVrbhNyRoFFesVvBvHAVMZMK0rw60E3X/5349M1GuVdKeazuksqopEdvkKwKGs21Q729jX81/bkBJg== | MIT. Mature docs option, but stable release retains Vite 5 and a second Vue runtime. Starlight fits a mostly HTML site and current toolchain without a framework migration. |
| Hand-written Markdown generator | Not adopted | Would duplicate maintained search, heading anchors, locale navigation and HTML escaping. No such local framework is needed. |

Primary sources: [Starlight release](https://github.com/withastro/starlight/tree/88ad3c2630487ba227a7b4ccbffc01a2bdf623a5), [configuration](https://starlight.astro.build/reference/configuration/), [i18n](https://starlight.astro.build/guides/i18n/), [Astro GitHub Pages deployment](https://docs.astro.build/en/guides/deploy/github/), [VitePress release](https://github.com/vuejs/vitepress/releases/tag/v1.6.4).

Open Starlight issues reviewed include #4190 (scoped style strategies), #4187 (built docs deployment), #4180 (Vitest 5 migration). Use default scoped styles and pinned tested build dependencies; do not introduce a runtime server or copy the upstream framework. No source is copied or substantially adapted beyond normal public API configuration.

## Design and verification

The final direction follows the restrained typography, spacing and product emphasis observed on [Apple](https://www.apple.com/mac/) and [OpenAI](https://openai.com/codex/) on 2026-09-10, without copying source or brand artwork. Static generated conversation illustrations were rejected during review. The implemented page uses an original centered black/white hero and a real React component demonstration with synthetic data, playback/pause/replay and bounded progression. Scroll reveals and control transitions respect reduced-motion preferences; content remains visible without JavaScript. EN pages label the demo's Chinese UI explicitly. Download links target the exact alpha.6 prerelease, not GitHub's stable-only latest alias.

`apps/site` owns public content and appearance. Developer contracts remain under `docs`; the public manual links to exact canonical contract pages instead of duplicating all engineering documents. Build the full site, check internal links and bilingual page pairs, exercise search and navigation in a browser at desktop and narrow sizes, and compare the render with the concept. Publish through a pinned GitHub Pages workflow only from the reviewed main branch.

## Monorepo static prerender dependency resolution

Reproduced `Named export parseCookie not found` with Astro **7.2.10**, Vite **8.2.2** and the checked-in npm graph. Astro correctly installs `cookie` **2.0.1** under its own node_modules and imports its `parseCookie` / `stringifySetCookie` API. Express 5.2.1 separately requires `cookie` **0.7.2**, which npm hoists at the monorepo root. The generated prerender module retains a bare external `cookie` import and resolves it from the output location to Express's incompatible version. This is a build externalization problem, not an absent Astro dependency.

Reviewed the installed Astro cookie source, Vite SSR externalization implementation, package licenses (MIT), exact lockfile graph, [Vite's documented SSR options](https://vite.dev/config/ssr-options.html), and [Astro upstream issue #9801](https://github.com/withastro/astro/issues/9801) concerning externalized cookie resolution. That older Vercel issue is related evidence, not a claim that it is the same regression. Astro 7 prerenders through its separate `prerender` Vite environment; the legacy `vite.ssr.noExternal` setting alone did not change that output in the reproduced failure. The narrow adapter is site-local `vite.environments.prerender.resolve.noExternal: ["cookie"]`: bundle the correctly resolved package while the original Astro importer context is still known. Inspected Astro `vite-plugin-environment/index.js` already applies the same treatment to `neotraverse` for [upstream issue #17508](https://github.com/withastro/astro/issues/17508). It changes no dependency versions, introduces no alias to a private path, and preserves Express's separate API. No upstream code is copied. Verification is the actual full static-site production build and its route/link checks, rather than a configuration-shaped unit test.

Validation after the prerender fix: `npm run build --workspace @openbot/site` passed on 2026-09-10. Astro generated 31 pages, Pagefind indexed the bilingual content, the real-component demo was copied, and local route/asset validation passed across 32 pages. The existing OpenBot pixel-bot SVG is reused as the missing favicon. The two site contract tests also passed. This is local production-build evidence; public GitHub Pages deployment and rendered interaction checks remain separate checks.
