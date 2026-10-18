import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { invoke, queryAsModule, resetModule, teardown, useModules } from "@homegrown/core/testing";
import { modules } from "../../../.homegrown/registry.server";
import type { Entry } from "../src/functions";

useModules(modules);
beforeEach(async () => {
  await resetModule("shopping-list");
  await resetModule("pantry");
});
afterAll(teardown);

const list = () => invoke<Entry[]>("shopping-list", "listEntries");

describe("shopping-list", () => {
  it("shopping.add-entry adds an open manual entry", async () => {
    await invoke("shopping-list", "addEntry", { title: "Brot", quantity: 2 });
    expect(await list()).toMatchObject([{ title: "Brot", quantity: 2, done: false, source: "manual" }]);
  });

  it("shopping.set-done checks an entry off and back on", async () => {
    const { id } = await invoke<{ id: string }>("shopping-list", "addEntry", { title: "Butter" });
    await invoke("shopping-list", "setDone", { id, done: true });
    expect((await list()).find((e) => e.id === id)?.done).toBe(true);
    await invoke("shopping-list", "setDone", { id, done: false });
    expect((await list()).find((e) => e.id === id)?.done).toBe(false);
  });

  it("shopping.clear-done removes only checked-off entries", async () => {
    const { id } = await invoke<{ id: string }>("shopping-list", "addEntry", { title: "Butter" });
    await invoke("shopping-list", "addEntry", { title: "Käse" });
    await invoke("shopping-list", "setDone", { id, done: true });
    expect(await invoke("shopping-list", "clearDone")).toEqual({ removed: 1 });
    expect((await list()).map((e) => e.title)).toEqual(["Käse"]);
  });

  it("shopping.low-stock-import adds every low pantry item once, via the pantry capability", async () => {
    await invoke("pantry", "addItem", { name: "Milch", unit: "Liter", quantity: 0, minQuantity: 2 });
    await invoke("pantry", "addItem", { name: "Kaffee", quantity: 1, minQuantity: 3 });
    await invoke("pantry", "addItem", { name: "Zucker", quantity: 5, minQuantity: 1 });
    await invoke("shopping-list", "addEntry", { title: "kaffee" });

    expect(await invoke("shopping-list", "addLowStock")).toEqual({ added: 1 });
    expect(await list()).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Milch", quantity: 2, unit: "Liter", source: "pantry" })]),
    );
    expect(await invoke("shopping-list", "addLowStock")).toEqual({ added: 0 });
  });

  it("shopping.isolation cannot read pantry tables directly", async () => {
    await expect(queryAsModule("shopping-list", "select * from pantry.items")).rejects.toThrow(/permission denied/);
  });
});
