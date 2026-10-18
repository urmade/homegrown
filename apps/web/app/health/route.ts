import { moduleHealth, modules } from "../../lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await Promise.all(
    modules.map(({ manifest }) => moduleHealth(manifest.name).catch(() => ({ module: manifest.name, ok: false }))),
  );
  const ok = results.every((r) => r?.ok);
  return Response.json({ ok, sha: process.env.HG_SHA ?? null, modules: results }, { status: ok ? 200 : 503 });
}
