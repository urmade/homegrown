import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getT, modules, resolveLocale } from "../lib/server";
import { AppNav } from "./app-nav";
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
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await resolveLocale();
  const t = await getT("core", locale);
  const titles = await Promise.all(modules.map(async (m) => [m.manifest.name, (await getT(m.manifest.name, locale))("title")] as const));
  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col">
        <header className="hg-safe-header shrink-0 border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center py-2 text-sm">
            <Link href="/" className="inline-flex min-h-11 items-center text-base font-semibold">
              {t("app.name")}
            </Link>
            <AppNav variant="header" titles={titles} settings={t("nav.settings")} admin={t("nav.admin")} />
          </nav>
        </header>
        <main className="hg-safe-main mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-auto">{children}</main>
        <AppNav variant="tabs" titles={titles} settings={t("nav.settings")} admin={t("nav.admin")} />
        <SwRegister message={t("sw.update")} action={t("sw.reload")} />
      </body>
    </html>
  );
}
