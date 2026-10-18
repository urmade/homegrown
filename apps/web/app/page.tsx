import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@homegrown/ui";
import { modules } from "../lib/server";

export default function Home() {
  return (
    <>
      <PageHeader title="Unser Haushalt" description="Alles an einem Ort." />
      {modules.length === 0 ? (
        <EmptyState>Noch keine Module. Wünsch dir eins über den Intake-Bot.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ manifest }) => (
            <Link key={manifest.name} href={`/${manifest.name}`}>
              <Card className="h-full hover:bg-surface-muted">
                <h2 className="text-lg font-semibold">{manifest.title}</h2>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
