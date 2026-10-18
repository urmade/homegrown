"use client";

import { useState, type FormEvent } from "react";
import { callFn } from "@homegrown/core/client";
import { Badge, Button, Card, Columns, EmptyState, Input, Notice } from "@homegrown/ui";
import type { Item } from "./functions";

export function PantryView({ initial }: { initial: Item[] }) {
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
      setError(
        navigator.onLine
          ? "Das hat nicht geklappt. Bitte erneut versuchen."
          : "Offline: Änderungen am Vorrat sind erst wieder online möglich.",
      );
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
            <EmptyState>Der Vorrat ist leer. Lege rechts den ersten Artikel an.</EmptyState>
          ) : (
            <ul className="divide-y divide-border" data-testid="pantry-items">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-fg-muted">
                      {item.quantity} {item.unit} · Minimum {item.min_quantity}
                    </p>
                  </div>
                  {item.quantity < item.min_quantity && <Badge tone="warn">knapp</Badge>}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      aria-label={`${item.name} verringern`}
                      disabled={busy}
                      onClick={() => run("adjustQuantity", { id: item.id, delta: -1 })}
                    >
                      −
                    </Button>
                    <Button
                      variant="secondary"
                      aria-label={`${item.name} erhöhen`}
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
          <h2 className="mb-3 font-semibold">Neuer Artikel</h2>
          <form onSubmit={add} className="grid grid-cols-2 gap-3">
            <Input label="Name" name="name" required maxLength={80} className="col-span-2" />
            <Input label="Einheit" name="unit" placeholder="Stück" maxLength={20} className="col-span-2" />
            <Input label="Bestand" name="quantity" type="number" min={0} defaultValue={0} />
            <Input label="Minimum" name="minQuantity" type="number" min={0} defaultValue={1} />
            <Button disabled={busy} className="col-span-2">
              Hinzufügen
            </Button>
          </form>
        </Card>
      }
    />
  );
}
