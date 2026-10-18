import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { invoke, queryAsModule, resetModule, teardown, useModules } from "@homegrown/core/testing";
import { modules } from "../../../.homegrown/registry.server";
import type { Item } from "../src/functions";

useModules(modules);
beforeEach(() => resetModule("pantry"));
afterAll(teardown);

const list = () => invoke<Item[]>("pantry", "listItems");

describe("pantry", () => {
  it("pantry.add-item adds an item with stock and minimum", async () => {
    await invoke("pantry", "addItem", { name: "Reis", unit: "kg", quantity: 1, minQuantity: 2 });
    expect(await list()).toMatchObject([{ name: "Reis", unit: "kg", quantity: 1, min_quantity: 2 }]);
  });

  it("pantry.adjust-quantity changes stock and never goes below zero", async () => {
    const { id } = await invoke<{ id: string }>("pantry", "addItem", { name: "Eier", quantity: 1 });
    expect(await invoke("pantry", "adjustQuantity", { id, delta: 2 })).toEqual({ quantity: 3 });
    expect(await invoke("pantry", "adjustQuantity", { id, delta: -10 })).toEqual({ quantity: 0 });
  });

  it("pantry.low-stock lists only items below their minimum, with the missing amount", async () => {
    await invoke("pantry", "addItem", { name: "Milch", unit: "Liter", quantity: 0, minQuantity: 2 });
    await invoke("pantry", "addItem", { name: "Mehl", quantity: 3, minQuantity: 1 });
    await invoke("pantry", "addItem", { name: "Salz", quantity: 1, minQuantity: 1 });
    expect(await invoke("pantry", "listLowStock")).toEqual([{ id: expect.any(String), name: "Milch", unit: "Liter", missing: 2 }]);
  });

  it("pantry.validation rejects invalid input", async () => {
    await expect(invoke("pantry", "addItem", { name: "" })).rejects.toThrow(/invalid input/);
  });

  it("pantry.isolation cannot read another module's schema", async () => {
    await expect(queryAsModule("pantry", "select * from shopping_list.entries")).rejects.toThrow(/permission denied/);
    await expect(queryAsModule("pantry", "select * from core.members")).rejects.toThrow(/permission denied/);
  });
});
