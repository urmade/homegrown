import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const LINKS = [
  ["/admin", "Übersicht"],
  ["/admin/logs", "Logs"],
  ["/admin/logs?level=error", "Fehler"],
  ["/admin/data-flow", "Datenfluss"],
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-hg border border-border bg-surface px-3 py-2 hover:bg-surface-muted">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
