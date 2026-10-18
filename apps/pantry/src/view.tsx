"use client";

import { useState, type FormEvent } from "react";
import { callFn, translator, type Messages } from "@homegrown/core/client";
import { Badge, Button, Card, Columns, EmptyState, Input, Notice } from "@homegrown/ui";
import type { Item } from "./functions";

export function PantryView({ initial, messages }: { initial: Item[]; messages: Messages }) {
  const t = translator(messages);
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: string, input: unknown) {
    setBusy(true);
    setError(null);
    try {
      await callFn("pantry", fn, input);
      setItems(await callFn<Item[]>("pantry", "listItems"));
    } catch {
      setError(t(navigator.onLine ? "error.retry" : "error.offline"));
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    await run("addItem", {
      name: data.get("name"),
      unit: data.get("unit") || undefined,
      quantity: Number(data.get("quantity") || 0),
      minQuantity: Number(data.get("minQuantity") || 0),
    });
    form.reset();
  }

  return (
    <Columns
      main={
        <Card>
          {error && <Notice tone="danger">{error}</Notice>}
          {items.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border" data-testid="pantry-items">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-fg-muted">
                      {t("item.stock", { quantity: item.quantity, unit: item.unit ?? t("unit.pieces"), min: item.min_quantity })}
                    </p>
                  </div>
                  {item.quantity < item.min_quantity && <Badge tone="warn">{t("item.low")}</Badge>}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      aria-label={t("item.decrease", { name: item.name })}
                      disabled={busy}
                      onClick={() => run("adjustQuantity", { id: item.id, delta: -1 })}
                    >
                      −
                    </Button>
                    <Button
                      variant="secondary"
                      aria-label={t("item.increase", { name: item.name })}
                      disabled={busy}
                      onClick={() => run("adjustQuantity", { id: item.id, delta: 1 })}
                    >
                      +
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      }
      aside={
        <Card>
          <h2 className="mb-3 font-semibold">{t("form.title")}</h2>
          <form onSubmit={add} className="grid grid-cols-2 gap-3">
            <Input label={t("form.name")} name="name" required maxLength={80} className="col-span-2" />
            <Input label={t("form.unit")} name="unit" placeholder={t("form.unitPlaceholder")} maxLength={20} className="col-span-2" />
            <Input label={t("form.quantity")} name="quantity" type="number" min={0} defaultValue={0} />
            <Input label={t("form.min")} name="minQuantity" type="number" min={0} defaultValue={1} />
            <Button disabled={busy} className="col-span-2">
              {t("form.submit")}
            </Button>
          </form>
        </Card>
      }
    />
  );
}
