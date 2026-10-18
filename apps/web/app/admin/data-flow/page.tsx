import { Badge, Card, EmptyState, Notice, PageHeader } from "@homegrown/ui";
import type { DataFlow } from "@homegrown/core";
import { getT, readDataFlow, resolveLocale, type Translate } from "../../../lib/server";

function CallGraph({ flow, label }: { flow: DataFlow; label: string }) {
  const names = flow.modules.map((m) => m.name);
  const w = Math.max(320, names.length * 220);
  const x = (name: string) => ((names.indexOf(name) + 0.5) * w) / names.length;
  const edges = flow.calls.map((c, i) => ({ ...c, a: c.from.split(".")[0]!, b: c.to.split(".")[0]!, i }));
  const top = 36 - edges.length * 9;
  return (
    <svg viewBox={`0 ${top} ${w} ${130 - top}`} className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-accent)" />
        </marker>
      </defs>
      {edges.map((e) => {
        const [x1, x2] = [x(e.a), x(e.b)];
        const dir = x2 >= x1 ? 1 : -1;
        const lift = 60 + e.i * 18;
        const apex = 100 - lift / 2;
        return (
          <g key={`${e.from}-${e.to}`}>
            <path d={`M${x1 + dir * 70},100 Q${(x1 + x2) / 2},${100 - lift} ${x2 - dir * 70},100`} fill="none" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" />
            <text x={(x1 + x2) / 2} y={apex - 8} textAnchor="middle" fontSize="12" fill="var(--color-fg-muted)">
              {e.from.split(".")[1]} → {e.to.split(".")[1]}
            </text>
          </g>
        );
      })}
      {names.map((n) => (
        <g key={n}>
          <rect x={x(n) - 70} y={80} width={140} height={40} rx={10} fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x={x(n)} y={105} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--color-fg)">
            {n}
          </text>
        </g>
      ))}
    </svg>
  );
}

const List = ({ label, items }: { label: string; items: string[] }) =>
  items.length ? (
    <p className="break-words text-sm">
      <span className="text-fg-muted">{label}: </span>
      {items.join(", ")}
    </p>
  ) : null;

export default async function DataFlowPage() {
  const flow = readDataFlow();
  const locale = await resolveLocale();
  const t: Translate = await getT("core", locale);
  if (!flow) return <EmptyState>{t("dataFlow.missing")}</EmptyState>;
  return (
    <>
      <PageHeader
        title={t("dataFlow.title")}
        description={[t("dataFlow.generated", { date: new Date(flow.generatedAt).toLocaleString(locale) }), flow.sha?.slice(0, 7)].filter(Boolean).join(" · ")}
      />
      {flow.errors.map((e) => (
        <Notice key={e} tone="danger">
          {e}
        </Notice>
      ))}
      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">{t("dataFlow.calls")}</h2>
        {flow.calls.length === 0 ? <p className="text-sm text-fg-muted">{t("dataFlow.noCalls")}</p> : <CallGraph flow={flow} label={t("dataFlow.graph")} />}
        <ul className="mt-2 space-y-1 text-sm">
          {flow.calls.map((c) => (
            <li key={`${c.from}-${c.to}`} className="break-words">
              <code>{c.from}</code> → <code>{c.to}</code>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">{t("dataFlow.modules")}</h2>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {flow.modules.map((m) => (
          <Card key={m.name}>
            <h3 className="font-semibold">
              {m.title} <span className="font-normal text-fg-muted">({m.name})</span>
            </h3>
            <ul className="mt-3 space-y-3">
              {m.functions.map((f) => (
                <li key={f.name}>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-medium">{f.name}</code>
                    {f.name in m.exports && <Badge tone="accent">{t("dataFlow.exported")}</Badge>}
                  </div>
                  <List label={t("dataFlow.reads")} items={f.reads} />
                  <List label={t("dataFlow.writes")} items={f.writes} />
                  <List label={t("dataFlow.calls.label")} items={f.calls} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t("dataFlow.tables")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {flow.tables.map((table) => (
          <Card key={table.name}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <code className="font-semibold">{table.name}</code>
              <Badge>{t("dataFlow.owner", { owner: table.owner })}</Badge>
            </div>
            <ul className="divide-y divide-border text-sm">
              {table.columns.map((c) => (
                <li key={c.name} className="py-2">
                  <code>{c.name}</code> <span className="text-xs text-fg-muted">{c.type}</span>
                  <List label={t("dataFlow.writes")} items={c.writers} />
                  <List label={t("dataFlow.reads")} items={c.readers} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
