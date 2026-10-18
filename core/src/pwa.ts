import { generateSW, type RuntimeCaching } from "workbox-build";
import type { ModuleManifest } from "./manifest";

const HANDLER = { "network-first": "NetworkFirst", "cache-first": "CacheFirst", "stale-while-revalidate": "StaleWhileRevalidate" } as const;

/** Paths the service worker must never cache. check-pwa verifies this in CI. */
export const NEVER_CACHE = ["/admin", "/api/auth", "/api/admin", "/health"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const prefix = (paths: string[]) => new RegExp(`^(${paths.map(escape).join("|")})(/|\\?|$)`);

/** Every module's offline declaration composed into the one core-owned service worker. */
export function runtimeCaching(manifests: ModuleManifest[]): RuntimeCaching[] {
  const rules: RuntimeCaching[] = [
    { urlPattern: ({ url }) => /^(\/admin|\/api\/auth|\/api\/admin|\/health)(\/|\?|$)/.test(url.pathname) || /\/health$/.test(url.pathname), handler: "NetworkOnly" },
    { urlPattern: /\/_next\/static\//, handler: "CacheFirst", options: { cacheName: "shell-static" } },
    { urlPattern: /\/icons\//, handler: "CacheFirst", options: { cacheName: "shell-static" } },
  ];
  for (const m of manifests) {
    const o = m.offline;
    if (o?.offlineWrites === "queue") {
      rules.push({
        urlPattern: new RegExp(`/api/fn/${escape(m.name)}/`),
        method: "POST",
        handler: "NetworkOnly",
        options: { backgroundSync: { name: `writes-${m.name}`, options: { maxRetentionTime: 24 * 60 } } },
      });
    }
    const paths = [...(o?.routes ?? []), ...(o?.data ?? [])];
    if (o && paths.length) {
      const pattern = prefix(paths).source;
      rules.push({
        urlPattern: new RegExp(pattern.replace("^", "^https?://[^/]+")),
        handler: HANDLER[o.strategy],
        options: { cacheName: `module-${m.name}`, precacheFallback: { fallbackURL: "/offline" } },
      });
    }
  }
  // Default: app shell cached; everything else is network-only with the offline notice page.
  rules.push({ urlPattern: ({ request }) => request.mode === "navigate", handler: "NetworkOnly", options: { precacheFallback: { fallbackURL: "/offline" } } });
  return rules;
}

export async function buildServiceWorker(manifests: ModuleManifest[], swDest: string, revision: string) {
  return generateSW({
    swDest,
    mode: "production",
    inlineWorkboxRuntime: true,
    sourcemap: false,
    clientsClaim: true,
    skipWaiting: false,
    globDirectory: undefined,
    globPatterns: [],
    additionalManifestEntries: [{ url: "/offline", revision }],
    runtimeCaching: runtimeCaching(manifests),
  });
}
