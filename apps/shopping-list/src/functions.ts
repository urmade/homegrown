import { z } from "zod";
import { defineFunctions } from "@homegrown/core";
import type { Calls } from "../.generated/client";
import type { DB } from "./db";

const fn = defineFunctions<DB, Calls>();

const Entry = z.object({
  id: z.string(),
  title: z.string(),
  quantity: z.number(),
  unit: z.string().nullable(),
  done: z.boolean(),
  source: z.enum(["manual", "pantry"]),
});
export type Entry = z.infer<typeof Entry>;

export const listEntries = fn(z.object({}), z.array(Entry), async (ctx) =>
  ctx.db
    .selectFrom("shopping_list.entries")
    .select(["id", "title", "quantity", "unit", "done", "source"])
    .orderBy("done")
    .orderBy("created_at", "desc")
    .execute(),
);

export const addEntry = fn(
  z.object({ title: z.string().trim().min(1).max(80), quantity: z.number().int().min(1).max(999).default(1), unit: z.string().trim().max(20).optional() }),
  z.object({ id: z.string() }),
  async (ctx, input) => {
    const member = await ctx.auth.currentMember();
    return ctx.db
      .insertInto("shopping_list.entries")
      .values({ title: input.title, quantity: input.quantity, unit: input.unit || null, added_by: member.id })
      .returning("id")
      .executeTakeFirstOrThrow();
  },
);

export const setDone = fn(z.object({ id: z.uuid(), done: z.boolean() }), z.object({ ok: z.literal(true) }), async (ctx, { id, done }) => {
  await ctx.db.updateTable("shopping_list.entries").set({ done }).where("id", "=", id).execute();
  return { ok: true as const };
});

export const clearDone = fn(z.object({}), z.object({ removed: z.number() }), async (ctx) => {
  const res = await ctx.db.deleteFrom("shopping_list.entries").where("done", "=", true).executeTakeFirst();
  return { removed: Number(res.numDeletedRows) };
});

/** Adds every low-stock pantry item that is not already open on the list. */
export const addLowStock = fn(z.object({}), z.object({ added: z.number() }), async (ctx) => {
  const low = await ctx.modules.pantry.listLowStock({});
  const open = await ctx.db.selectFrom("shopping_list.entries").select("title").where("done", "=", false).execute();
  const openTitles = new Set(open.map((e) => e.title.toLowerCase()));
  const missing = low.filter((i) => !openTitles.has(i.name.toLowerCase()));
  if (missing.length === 0) return { added: 0 };
  const member = await ctx.auth.currentMember();
  await ctx.db
    .insertInto("shopping_list.entries")
    .values(missing.map((i) => ({ title: i.name, quantity: i.missing, unit: i.unit, source: "pantry" as const, added_by: member.id })))
    .execute();
  return { added: missing.length };
});
