import { moduleHealth } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  try {
    const health = await moduleHealth(module);
    return health ? Response.json(health) : Response.json({ ok: false }, { status: 404 });
  } catch {
    return Response.json({ module, ok: false }, { status: 503 });
  }
}
