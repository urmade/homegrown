import { Badge, Button, Card, EmptyState, PageHeader } from "@homegrown/ui";
import { getFlag, getT, recentEvents, resolveLocale } from "../../lib/server";
import { togglePauseDeploys } from "./actions";

export default async function Admin() {
  const locale = await resolveLocale();
  const [paused, events, t] = await Promise.all([getFlag("pause_deploys"), recentEvents(), getT("core", locale)]);
  return (
    <>
      <PageHeader title={t("admin.title")} description={t("admin.version", { sha: process.env.HG_SHA?.slice(0, 7) ?? t("admin.versionLocal") })} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="font-semibold">{t("admin.deploys")}</h2>
          <p className="mt-1 text-sm text-fg-muted">{t(paused ? "admin.deploysPaused" : "admin.deploysActive")}</p>
          <form action={togglePauseDeploys} className="mt-4">
            <Button variant={paused ? "primary" : "secondary"} className="w-full">
              {t(paused ? "admin.resume" : "admin.pause")}
            </Button>
          </form>
        </Card>
        <Card className="md:col-span-2">
          <h2 className="mb-3 font-semibold">{t("admin.history")}</h2>
          {events.length === 0 ? (
            <EmptyState>{t("admin.noEvents")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone={e.kind === "rollback" ? "warn" : "neutral"}>{e.kind}</Badge>
                  <span className="min-w-0 flex-1 break-all text-fg-muted">{JSON.stringify(e.detail)}</span>
                  <time className="text-xs text-fg-muted">{new Date(e.ts).toLocaleString(locale)}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
