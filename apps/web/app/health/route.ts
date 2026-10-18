import { moduleHealth, modules } from "../../lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await Promise.all(
    modules.map(({ manifest }) => moduleHealth(manifest.name).catch(() => ({ module: manifest.name, ok: false }))),
  );
  // Throwaway pipeline proof: red only where the prod env sets the flag (staging and CI never do). Reverted by the deploy agent.
  const ok = results.every((r) => r?.ok) && process.env.HG_SMOKE_DEMO_FAIL !== "1";
  return Response.json({ ok, sha: process.env.HG_SHA ?? null, modules: results }, { status: ok ? 200 : 503 });
}
