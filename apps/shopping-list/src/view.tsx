"use client";

import { useState, type FormEvent } from "react";
import { callFn } from "@homegrown/core/client";
import { Badge, Button, Card, Columns, EmptyState, Input, Notice } from "@homegrown/ui";
import type { Entry } from "./functions";

export function ShoppingView({ initial }: { initial: Entry[] }) {
  const [entries, setEntries] = useState(initial);
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "danger" } | null>(null);
  const [busy, setBusy] = useState(false);

  // Offline writes are queued by the service worker and replayed later (last write wins); show them optimistically.
  async function run(fn: string, input: unknown, optimistic: (list: Entry[]) => Entry[], success?: (out: unknown) => string) {
    setBusy(true);
    setNotice(null);
    setEntries(optimistic);
    try {
      const out = await callFn("shopping-list", fn, input);
      setEntries(await callFn<Entry[]>("shopping-list", "listEntries"));
      if (success) setNotice({ text: success(out), tone: "neutral" });
    } catch {
      if (navigator.onLine) {
        setNotice({ text: "Das hat nicht geklappt. Bitte erneut versuchen.", tone: "danger" });
        setEntries(await callFn<Entry[]>("shopping-list", "listEntries").catch(() => entries));
      } else setNotice({ text: "Offline gespeichert. Wird synchronisiert, sobald du wieder online bist.", tone: "neutral" });
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "");
    const quantity = Number(data.get("quantity") || 1);
    form.reset();
    await run("addEntry", { title, quantity }, (list) => [
      { id: `offline-${Date.now()}`, title, quantity, unit: null, done: false, source: "manual" },
      ...list,
    ]);
  }

  const open = entries.filter((e) => !e.done).length;

  return (
    <Columns
      main={
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{open} offen</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    "addLowStock",
                    {},
                    (l) => l,
                    (out) => `${(out as { added: number }).added} Artikel aus dem Vorrat ergänzt.`,
                  )
                }
              >
                Aus Vorrat ergänzen
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => run("clearDone", {}, (l) => l.filter((e) => !e.done))}>
                Erledigte entfernen
              </Button>
            </div>
          </div>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          {entries.length === 0 ? (
            <EmptyState>Die Liste ist leer.</EmptyState>
          ) : (
            <ul className="divide-y divide-border" data-testid="shopping-entries">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-accent"
                    aria-label={`${entry.title} erledigt`}
                    checked={entry.done}
                    disabled={busy || entry.id.startsWith("offline-")}
                    onChange={() =>
                      run("setDone", { id: entry.id, done: !entry.done }, (l) =>
                        l.map((e) => (e.id === entry.id ? { ...e, done: !e.done } : e)),
                      )
                    }
                  />
                  <span className={`min-w-0 flex-1 break-words ${entry.done ? "text-fg-muted line-through" : ""}`}>
                    {entry.quantity} {entry.unit ?? "×"} {entry.title}
                  </span>
                  {entry.source === "pantry" && <Badge tone="accent">Vorrat</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      }
      aside={
        <Card>
          <h2 className="mb-3 font-semibold">Hinzufügen</h2>
          <form onSubmit={add} className="grid grid-cols-3 gap-3">
            <Input label="Artikel" name="title" required maxLength={80} className="col-span-2" />
            <Input label="Menge" name="quantity" type="number" min={1} defaultValue={1} />
            <Button disabled={busy} className="col-span-3">
              Auf die Liste
            </Button>
          </form>
        </Card>
      }
    />
  );
}
