import { execFileSync } from "node:child_process";

export async function readInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export const sh = (cmd, args) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 << 20 }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

export const relPath = (p) => (p ? p.replace(`${process.cwd()}/`, "") : "");
