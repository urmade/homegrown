import { Badge, Button, Card, EmptyState, PageHeader } from "@homegrown/ui";
import { getFlag, recentEvents } from "../../lib/server";
import { togglePauseDeploys } from "./actions";

export default async function Admin() {
  const [paused, events] = await Promise.all([getFlag("pause_deploys"), recentEvents()]);
  return (
    <>
      <PageHeader title="Verwaltung" description={`Version ${process.env.HG_SHA?.slice(0, 7) ?? "lokal"}`} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="font-semibold">Deploys</h2>
          <p className="mt-1 text-sm text-fg-muted">{paused ? "Pausiert: neue Versionen werden nicht ausgerollt." : "Aktiv: grüne Versionen werden automatisch ausgerollt."}</p>
          <form action={togglePauseDeploys} className="mt-4">
            <Button variant={paused ? "primary" : "secondary"} className="w-full">
              {paused ? "Deploys fortsetzen" : "Deploys pausieren"}
            </Button>
          </form>
        </Card>
        <Card className="md:col-span-2">
          <h2 className="mb-3 font-semibold">Verlauf</h2>
          {events.length === 0 ? (
            <EmptyState>Noch keine Ereignisse.</EmptyState>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone={e.kind === "rollback" ? "warn" : "neutral"}>{e.kind}</Badge>
                  <span className="min-w-0 flex-1 break-all text-fg-muted">{JSON.stringify(e.detail)}</span>
                  <time className="text-xs text-fg-muted">{new Date(e.ts).toLocaleString("de-DE")}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
