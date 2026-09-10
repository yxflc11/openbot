import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://yxflc11.github.io",
  base: "/openbot",
  // Preserve Astro's nested cookie API when prerendering in the monorepo.
  vite: { environments: { prerender: { resolve: { noExternal: ["cookie"] } } } },
  integrations: [
    starlight({
      title: "OpenBot",
      description: "Your Bots, working together. A local-first open-source workspace.",
      locales: {
        root: { label: "English", lang: "en" },
        "zh-cn": { label: "简体中文", lang: "zh-CN" },
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/yxflc11/openbot" }],
      editLink: { baseUrl: "https://github.com/yxflc11/openbot/edit/main/apps/site/" },
      customCss: ["./src/styles/docs.css"],
      sidebar: [
        {
          label: "Using OpenBot",
          translations: { "zh-CN": "使用 OpenBot" },
          items: [
            { slug: "manual/installation" },
            { slug: "manual/bots" },
            { slug: "manual/channels" },
            { slug: "manual/attachments" },
            { slug: "manual/sharing" },
            { slug: "manual/settings" },
            { slug: "manual/automations" },
            { slug: "manual/troubleshooting" },
          ],
        },
        {
          label: "Extend OpenBot",
          translations: { "zh-CN": "扩展 OpenBot" },
          items: [
            { slug: "plugins/protocol" },
            { slug: "plugins/quickstart" },
            { slug: "plugins/catalog" },
            { slug: "plugins/contribute" },
          ],
        },
        {
          label: "Project",
          translations: { "zh-CN": "项目" },
          items: [{ slug: "manual/architecture" }, { slug: "manual/status" }],
        },
      ],
    }),
  ],
});
