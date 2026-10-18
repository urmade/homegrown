import { sql, type Kysely, type Transaction } from "kysely";
import type { z } from "zod";
import { withContext, currentContext } from "./context";
import { AccessRecorder, baseDb } from "./db";
import { log, errorData, type Logger } from "./log";
import type { Catalogs } from "./i18n";
import { roleOf, type ModuleManifest } from "./manifest";

export type Member = { id: string; displayName: string };

export type Ctx<DB, Calls> = {
  db: Kysely<DB>;
  log: Logger;
  auth: { currentMember(): Promise<Member> };
  modules: Calls;
};

export type ModuleFn<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> = {
  input: I;
  output: O;
  handler: (ctx: Ctx<any, any>, input: z.output<I>) => Promise<z.input<O>>;
};

/** `const fn = defineFunctions<DB, Calls>()` in a module's functions.ts; Calls comes from the generated client. */
export function defineFunctions<DB, Calls = Record<string, never>>() {
  return <I extends z.ZodType, O extends z.ZodType>(
    input: I,
    output: O,
    handler: (ctx: Ctx<DB, Calls>, input: z.output<I>) => Promise<z.input<O>>,
  ): ModuleFn<I, O> => ({ input, output, handler });
}

/** Typed client for another module: only the capabilities a module declares in module.json exist on it. */
export type ClientOf<F, K extends keyof F> = {
  [P in K]: F[P] extends ModuleFn<infer I, infer O> ? (input: z.input<I>) => Promise<z.output<O>> : never;
};

export type RegisteredModule = { manifest: ModuleManifest; functions: Record<string, unknown>; messages?: Catalogs };

const registry = new Map<string, RegisteredModule>();

export function registerModules(mods: RegisteredModule[]) {
  for (const m of mods) registry.set(m.manifest.name, m);
}

export const registeredModules = () => [...registry.values()];

/** v1 mock adapter: members exist, everyone sees everything. v2 replaces this with passkey accounts. */
let memberCache: Member | undefined;
export const auth = {
  async currentMember(): Promise<Member> {
    memberCache ??= await baseDb()
      .selectFrom("core.members")
      .select(["id", "display_name as displayName"])
      .orderBy("created_at")
      .executeTakeFirstOrThrow();
    return memberCache;
  },
};

export class InputError extends Error {}

async function call(trx: Transaction<any>, module: string, fnName: string, rawInput: unknown, caller?: string): Promise<unknown> {
  const mod = registry.get(module);
  const decl = mod?.manifest.functions.find((f) => f.name === fnName);
  const impl = mod?.functions[fnName] as ModuleFn | undefined;
  if (!mod || !decl || !impl) throw new InputError(`unknown function ${module}.${fnName}`);
  const parsed = impl.input.safeParse(rawInput);
  if (!parsed.success) throw new InputError(`invalid input for ${module}.${fnName}`);

  await sql`set local role ${sql.id(roleOf(module))}`.execute(trx);
  try {
    const modules: Record<string, Record<string, (input: unknown) => Promise<unknown>>> = {};
    for (const target of decl.calls) {
      const [m, cap] = target.split(".") as [string, string];
      if (!(cap in (registry.get(m)?.manifest.exports ?? {}))) throw new Error(`${m}.${cap} is not an exported capability`);
      (modules[m] ??= {})[cap] = (input) => {
        log.info("capability.call", { capability: target });
        return call(trx, m, cap, input, module);
      };
    }
    const ctx: Ctx<any, any> = { db: trx.withPlugin(new AccessRecorder(module, decl)), log, auth, modules };
    const out = await withContext({ module, fn: fnName }, () => impl.handler(ctx, parsed.data));
    return impl.output.parse(out);
  } finally {
    if (caller) await sql`set local role ${sql.id(roleOf(caller))}`.execute(trx);
  }
}

/** Runs one module function in its own transaction under the module's DB role. */
export async function invoke<T = unknown>(module: string, fn: string, input: unknown = {}): Promise<T> {
  const member = await auth.currentMember();
  return withContext({ memberId: member.id, correlationId: currentContext()?.correlationId ?? crypto.randomUUID() }, async () => {
    const started = Date.now();
    try {
      const out = await baseDb().transaction().execute((trx) => call(trx, module, fn, input));
      log.info("fn.call", { route: `${module}.${fn}`, durationMs: Date.now() - started });
      return out as T;
    } catch (e) {
      log[e instanceof InputError ? "warn" : "error"]("fn.failed", { route: `${module}.${fn}`, ...errorData(e) });
      throw e;
    }
  });
}
