import { z } from "zod";
import { defineFunctions } from "@homegrown/core";
import type { Calls } from "../.generated/client";
import type { DB } from "./db";

const fn = defineFunctions<DB, Calls>();

const Item = z.object({ id: z.string(), name: z.string(), unit: z.string(), quantity: z.number(), min_quantity: z.number() });
export type Item = z.infer<typeof Item>;

export const listItems = fn(z.object({}), z.array(Item), async (ctx) =>
  ctx.db.selectFrom("pantry.items").select(["id", "name", "unit", "quantity", "min_quantity"]).orderBy("name").execute(),
);

export const addItem = fn(
  z.object({
    name: z.string().trim().min(1).max(80),
    unit: z.string().trim().min(1).max(20).default("Stück"),
    quantity: z.number().int().min(0).default(0),
    minQuantity: z.number().int().min(0).default(0),
  }),
  z.object({ id: z.string() }),
  async (ctx, input) => {
    const member = await ctx.auth.currentMember();
    return ctx.db
      .insertInto("pantry.items")
      .values({ name: input.name, unit: input.unit, quantity: input.quantity, min_quantity: input.minQuantity, updated_by: member.id })
      .returning("id")
      .executeTakeFirstOrThrow();
  },
);

export const adjustQuantity = fn(
  z.object({ id: z.uuid(), delta: z.number().int().min(-100).max(100) }),
  z.object({ quantity: z.number() }),
  async (ctx, { id, delta }) => {
    const item = await ctx.db.selectFrom("pantry.items").select("quantity").where("id", "=", id).forUpdate().executeTakeFirstOrThrow();
    const quantity = Math.max(0, item.quantity + delta);
    const member = await ctx.auth.currentMember();
    await ctx.db.updateTable("pantry.items").set({ quantity, updated_by: member.id, updated_at: new Date() }).where("id", "=", id).execute();
    return { quantity };
  },
);

export const listLowStock = fn(
  z.object({}),
  z.array(z.object({ id: z.string(), name: z.string(), unit: z.string(), missing: z.number() })),
  async (ctx) => {
    const rows = await ctx.db
      .selectFrom("pantry.items")
      .select(["id", "name", "unit", "quantity", "min_quantity"])
      .whereRef("quantity", "<", "min_quantity")
      .orderBy("name")
      .execute();
    return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, missing: r.min_quantity - r.quantity }));
  },
);
