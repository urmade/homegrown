import { readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { NextConfig } from "next";

const root = resolve(process.cwd(), "../..");
const modulePackages = readdirSync(join(root, "apps"))
  .filter((d) => existsSync(join(root, "apps", d, "module.json")))
  .map((d) => JSON.parse(readFileSync(join(root, "apps", d, "package.json"), "utf8")).name as string);

const config: NextConfig = {
  transpilePackages: ["@homegrown/core", "@homegrown/ui", ...modulePackages],
  serverExternalPackages: ["pg", "workbox-build"],
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
  agentRules: false,
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default config;
