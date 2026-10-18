import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadManifests } from "../../../core/src/manifest";

const mods = loadManifests();

export const routes = ["/", "/offline", "/setup", "/settings", "/admin", "/admin/logs", "/admin/data-flow", ...mods.map((m) => `/${m.manifest.name}`)];

export const offlineRoutes = mods.flatMap((m) => m.manifest.offline?.routes ?? []);

/** Routes a module's DESIGN.md exempts from the overflow check ("responsive-exception: /route"). */
export const responsiveExceptions = new Set(
  mods.flatMap((m) => {
    const file = join(m.dir, "DESIGN.md");
    return existsSync(file) ? [...readFileSync(file, "utf8").matchAll(/responsive-exception:\s*(\S+)/g)].map((x) => x[1]!) : [];
  }),
);
