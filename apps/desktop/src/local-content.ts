import { join } from "node:path";

export const DESKTOP_SCHEME = "openbot";
export const DESKTOP_RENDERER_HOST = "app";
export const DESKTOP_ENTRY_URL = `${DESKTOP_SCHEME}://${DESKTOP_RENDERER_HOST}/index.html`;

export function isDesktopAssetRequestMethod(method: string): boolean {
  return method === "GET";
}

export function resolveDesktopAssetPath(
  rendererRoot: string,
  requestUrl: string,
): string | undefined {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return undefined;
  }

  if (
    url.protocol !== `${DESKTOP_SCHEME}:` ||
    url.hostname !== DESKTOP_RENDERER_HOST ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    return undefined;
  }

  // URL parsing normalizes encoded dot segments, so inspect the unnormalized path after validating
  // the origin. Each decoded segment must remain exactly one portable path component.
  const authorityStart = requestUrl.indexOf("://") + 3;
  const pathStart = requestUrl.indexOf("/", authorityStart);
  const rawPath = pathStart === -1 ? "" : (requestUrl.slice(pathStart).split(/[?#]/u, 1)[0] ?? "");
  const encodedSegments = rawPath.split("/").filter(Boolean);
  if (encodedSegments.length === 0) return undefined;

  const segments: string[] = [];
  for (const encodedSegment of encodedSegments) {
    let segment: string;
    try {
      segment = decodeURIComponent(encodedSegment);
    } catch {
      return undefined;
    }

    if (
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0")
    ) {
      return undefined;
    }
    segments.push(segment);
  }

  return join(rendererRoot, ...segments);
}
