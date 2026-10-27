import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getT, modules, resolveLocale } from "../lib/server";
import { SwRegister } from "./sw-register";
import "./globals.css";

// Every page depends on the household or member language, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("core");
  return {
    title: t("app.name"),
    description: t("app.description"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: t("app.name") },
    icons: { icon: "/icons/192", apple: "/icons/192" },
  };
}

export const viewport: Viewport = {
  themeColor: "#3f7d4e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await resolveLocale();
  const t = await getT("core", locale);
  const titles = await Promise.all(modules.map(async (m) => [m.manifest.name, (await getT(m.manifest.name, locale))("title")] as const));
  return (
    <html lang={locale}>
      <body className="min-h-dvh">
        <header className="hg-safe-header border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
            <Link href="/" className="mr-auto inline-flex min-h-11 items-center text-base font-semibold">
              {t("app.name")}
            </Link>
            {titles.map(([name, title]) => (
              <Link key={name} href={`/${name}`} className="inline-flex min-h-11 items-center rounded-hg px-2 hover:bg-surface-muted">
                {title}
              </Link>
            ))}
            <Link href="/settings" className="inline-flex min-h-11 items-center rounded-hg px-2 text-fg-muted hover:bg-surface-muted">
              {t("nav.settings")}
            </Link>
            <Link href="/admin" className="inline-flex min-h-11 items-center rounded-hg px-2 text-fg-muted hover:bg-surface-muted">
              {t("nav.admin")}
            </Link>
          </nav>
        </header>
        <main className="hg-safe-main mx-auto max-w-5xl">{children}</main>
        <SwRegister message={t("sw.update")} action={t("sw.reload")} />
      </body>
    </html>
  );
}
