import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@homegrown/ui";
import { getT, queryLogs, resolveLocale, type LogFilter } from "../../../lib/server";

const LEVELS = ["", "error", "warn", "info", "debug"];

export default async function Logs({ searchParams }: { searchParams: Promise<LogFilter> }) {
  const f = await searchParams;
  const locale = await resolveLocale();
  const [rows, t] = await Promise.all([queryLogs(f), getT("core", locale)]);
  return (
    <>
      <PageHeader title={t("logs.title")} description={t("logs.description")} />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Input label={t("logs.module")} name="module" defaultValue={f.module} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{t("logs.level")}</span>
            <select
              name="level"
              defaultValue={f.level ?? ""}
              className="min-h-11 rounded-hg border border-border bg-surface px-3 text-base text-fg"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l || t("logs.allLevels")}
                </option>
              ))}
            </select>
          </label>
          <Input label={t("logs.correlationId")} name="correlationId" defaultValue={f.correlationId} />
          <Input label={t("logs.sha")} name="sha" defaultValue={f.sha} />
          <Button>{t("logs.filter")}</Button>
        </form>
      </Card>
      {rows.length === 0 ? (
        <EmptyState>{t("logs.empty")}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-hg border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.level === "error" ? "warn" : r.level === "info" ? "accent" : "neutral"}>{r.level}</Badge>
                <span className="font-medium">{r.msg}</span>
                <span className="text-fg-muted">{[r.module, r.fn].filter(Boolean).join(".")}</span>
                <time className="ml-auto text-xs text-fg-muted">{new Date(r.ts).toLocaleString(locale)}</time>
              </div>
              {r.data && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs text-fg-muted">{JSON.stringify(r.data)}</pre>}
              {r.correlation_id && (
                <a href={`/admin/logs?correlationId=${r.correlation_id}`} className="mt-1 inline-block break-all text-xs text-accent">
                  {r.correlation_id}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
