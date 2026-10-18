import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@homegrown/ui";
import { getT, modules, resolveLocale } from "../lib/server";
import { requireSetup } from "../lib/setup";

export default async function Home() {
  await requireSetup();
  const locale = await resolveLocale();
  const t = await getT("core", locale);
  const titles = await Promise.all(modules.map(async (m) => [m.manifest.name, (await getT(m.manifest.name, locale))("title")] as const));
  return (
    <>
      <PageHeader title={t("home.title")} description={t("home.description")} />
      {titles.length === 0 ? (
        <EmptyState>{t("home.empty")}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {titles.map(([name, title]) => (
            <Link key={name} href={`/${name}`}>
              <Card className="h-full hover:bg-surface-muted">
                <h2 className="text-lg font-semibold">{title}</h2>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
