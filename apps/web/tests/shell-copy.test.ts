import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";
import { shellCopy } from "../lib/shell-copy";
import en from "../messages/en.json";
import de from "../messages/de.json";

it("ux.a26.lang web en and de catalogs have the same keys", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  expect(shellCopy("en").more).toBe("More");
  expect(shellCopy("de").more).toBe("Mehr");
  expect(shellCopy("en").home).toBe("Start");
  expect(shellCopy("de").home).toBe("Start");
  expect(shellCopy("en").appearance).toBe("Appearance");
  expect(shellCopy("de").appearance).toBe("Darstellung");
});

it("ux.a25.hex module src has no hard-coded hex", () => {
  const root = process.cwd();
  const apps = readdirSync(join(root, "apps")).filter((d) => d !== "web");
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  const hits: string[] = [];
  for (const app of apps) {
    try {
      const out = execFileSync("rg", ["-n", "#[0-9a-fA-F]{3,8}\\b", `apps/${app}/src`], { cwd: root, encoding: "utf8" });
      if (out.trim()) hits.push(out.trim());
    } catch (e) {
      const err = e as { status?: number; stdout?: string };
      if (err.status && err.status !== 1 && err.stdout) hits.push(err.stdout);
    }
  }
  expect(hits.join("\n")).toBe("");
  expect(hex.test("#fff")).toBe(true);
});
