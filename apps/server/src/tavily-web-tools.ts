import { z } from "zod";
import { boundedFetch } from "./model-client.js";
import { validateWebCall, type WebToolExecutor } from "./model-web-tools.js";

/** Retrieval credentials go only to this fixed service, never to the selected chat provider. */
export function createTavilyWebExecutor(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): WebToolExecutor {
  const request = boundedFetch(fetcher, 256 * 1024);
  return {
    async execute(name, args, signal) {
      validateWebCall(name, args);
      const input = JSON.parse(args);
      const body =
        name === "web_search"
          ? {
              query: input.classes?.length
                ? `${input.query} (${input.classes.join(", ")})`
                : input.query,
              search_depth: "basic",
              topic: "general",
              max_results: 5,
              include_answer: false,
              include_raw_content: false,
            }
          : { urls: [input.url], extract_depth: "basic", format: "markdown" };
      const response = await request(
        `https://api.tavily.com/${name === "web_search" ? "search" : "extract"}`,
        {
          method: "POST",
          redirect: "error",
          signal,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error("Retrieval service rejected the request.");
      const result = await response.json();
      if (name === "web_search") {
        const parsed = z
          .object({
            results: z
              .array(
                z.object({
                  url: z.url(),
                  title: z.string(),
                  content: z.string(),
                  published_date: z.string().optional(),
                }),
              )
              .max(5),
          })
          .parse(result);
        return JSON.stringify({
          retrievedAt: new Date().toISOString(),
          results: parsed.results.map((item) => ({
            url: item.url.slice(0, 2048),
            title: item.title.slice(0, 500),
            content: item.content.slice(0, 5000),
            publishedDate: item.published_date,
          })),
        });
      }
      const parsed = z
        .object({ results: z.array(z.object({ url: z.url(), raw_content: z.string() })).length(1) })
        .parse(result);
      const item = parsed.results[0];
      if (!item?.raw_content.trim()) throw new Error("No readable source content.");
      const start = input.start_index ?? 0;
      return JSON.stringify({
        retrievedAt: new Date().toISOString(),
        url: item.url,
        content: item.raw_content.slice(start, start + (input.max_length ?? 5000)),
        totalCharacters: item.raw_content.length,
      });
    },
  };
}
