"use client";

import { useState, type FormEvent } from "react";
import { callFn, translator, type Messages } from "@homegrown/core/client";
import { Badge, Button, Card, Columns, EmptyState, Input, Notice } from "@homegrown/ui";
import type { Entry } from "./functions";

export function ShoppingView({ initial, messages }: { initial: Entry[]; messages: Messages }) {
  const t = translator(messages);
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
        setNotice({ text: t("error.retry"), tone: "danger" });
        setEntries(await callFn<Entry[]>("shopping-list", "listEntries").catch(() => entries));
      } else setNotice({ text: t("savedOffline"), tone: "neutral" });
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
            <h2 className="font-semibold">{t("open", { count: open })}</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    "addLowStock",
                    {},
                    (l) => l,
                    (out) => t("addedLowStock", { count: (out as { added: number }).added }),
                  )
                }
              >
                {t("addLowStock")}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => run("clearDone", {}, (l) => l.filter((e) => !e.done))}>
                {t("clearDone")}
              </Button>
            </div>
          </div>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          {entries.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border" data-testid="shopping-entries">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-accent"
                    aria-label={t("entry.done", { title: entry.title })}
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
                  {entry.source === "pantry" && <Badge tone="accent">{t("entry.fromPantry")}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      }
      aside={
        <Card>
          <h2 className="mb-3 font-semibold">{t("form.title")}</h2>
          <form onSubmit={add} className="grid grid-cols-3 gap-3">
            <Input label={t("form.item")} name="title" required maxLength={80} className="col-span-2" />
            <Input label={t("form.quantity")} name="quantity" type="number" min={1} defaultValue={1} />
            <Button disabled={busy} className="col-span-3">
              {t("form.submit")}
            </Button>
          </form>
        </Card>
      }
    />
  );
}
