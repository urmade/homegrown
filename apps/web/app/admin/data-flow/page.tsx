import { Badge, Card, EmptyState, Notice, PageHeader } from "@homegrown/ui";
import type { DataFlow } from "@homegrown/core";
import { readDataFlow } from "../../../lib/server";

function CallGraph({ flow }: { flow: DataFlow }) {
  const names = flow.modules.map((m) => m.name);
  const w = Math.max(320, names.length * 220);
  const x = (name: string) => ((names.indexOf(name) + 0.5) * w) / names.length;
  const edges = flow.calls.map((c, i) => ({ ...c, a: c.from.split(".")[0]!, b: c.to.split(".")[0]!, i }));
  const top = 36 - edges.length * 9;
  return (
    <svg viewBox={`0 ${top} ${w} ${130 - top}`} className="h-auto w-full" role="img" aria-label="Modul-Aufrufgraph">
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

export default function DataFlowPage() {
  const flow = readDataFlow();
  if (!flow) return <EmptyState>data-flow.json fehlt. Es wird beim Image-Build erzeugt (pnpm gen:data-flow).</EmptyState>;
  return (
    <>
      <PageHeader title="Datenfluss" description={`Generiert ${new Date(flow.generatedAt).toLocaleString("de-DE")}${flow.sha ? ` · ${flow.sha.slice(0, 7)}` : ""}`} />
      {flow.errors.map((e) => (
        <Notice key={e} tone="danger">
          {e}
        </Notice>
      ))}
      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Modul-Aufrufe</h2>
        {flow.calls.length === 0 ? <p className="text-sm text-fg-muted">Keine modulübergreifenden Aufrufe.</p> : <CallGraph flow={flow} />}
        <ul className="mt-2 space-y-1 text-sm">
          {flow.calls.map((c) => (
            <li key={`${c.from}-${c.to}`} className="break-words">
              <code>{c.from}</code> → <code>{c.to}</code>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Module</h2>
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
                    {f.name in m.exports && <Badge tone="accent">exportiert</Badge>}
                  </div>
                  <List label="liest" items={f.reads} />
                  <List label="schreibt" items={f.writes} />
                  <List label="ruft" items={f.calls} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Tabellen</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {flow.tables.map((t) => (
          <Card key={t.name}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <code className="font-semibold">{t.name}</code>
              <Badge>Besitzer: {t.owner}</Badge>
            </div>
            <ul className="divide-y divide-border text-sm">
              {t.columns.map((c) => (
                <li key={c.name} className="py-2">
                  <code>{c.name}</code> <span className="text-xs text-fg-muted">{c.type}</span>
                  <List label="schreibt" items={c.writers} />
                  <List label="liest" items={c.readers} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
