import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function moduleRoutes() {
  const apps = join(process.cwd(), "apps");
  return readdirSync(apps)
    .filter((d) => d !== "web" && existsSync(join(apps, d, "module.json")))
    .map((d) => `/${JSON.parse(readFileSync(join(apps, d, "module.json"), "utf8")).name as string}`);
}
