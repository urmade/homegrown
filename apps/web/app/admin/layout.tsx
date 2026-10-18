import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "../../lib/server";
import { requireSetup } from "../../lib/setup";

const LINKS = [
  ["/admin", "admin.nav.overview"],
  ["/admin/logs", "admin.nav.logs"],
  ["/admin/logs?level=error", "admin.nav.errors"],
  ["/admin/data-flow", "admin.nav.dataFlow"],
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSetup();
  const t = await getT("core");
  return (
    <>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {LINKS.map(([href, key]) => (
          <Link key={href} href={href} className="rounded-hg border border-border bg-surface px-3 py-2 hover:bg-surface-muted">
            {t(key)}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
