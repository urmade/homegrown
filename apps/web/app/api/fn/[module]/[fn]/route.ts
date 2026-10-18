import { randomUUID } from "node:crypto";
import { InputError, invoke, withContext } from "../../../../../lib/server";

export const dynamic = "force-dynamic";

/** UI entry point for module functions: POST JSON in, JSON out, one transaction per request. */
export async function POST(req: Request, { params }: { params: Promise<{ module: string; fn: string }> }) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });
  const { module, fn } = await params;
  const correlationId = randomUUID();
  const input = await req.json().catch(() => ({}));
  return withContext({ correlationId }, async () => {
    try {
      return Response.json(await invoke(module, fn, input));
    } catch (e) {
      if (e instanceof InputError) return Response.json({ error: e.message, correlationId }, { status: 400 });
      return Response.json({ error: "internal error", correlationId }, { status: 500 });
    }
  });
}
