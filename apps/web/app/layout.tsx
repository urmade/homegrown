import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { THEME_BOOT_SCRIPT } from "@homegrown/ui/theme";
import { getT, modules, resolveLocale } from "../lib/server";
import { shellCopy } from "../lib/shell-copy";
import { AppShell } from "./app-shell";
import { SwRegister } from "./sw-register";
import { ThemeSync } from "./theme-sync";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("core");
  return {
    title: t("app.name"),
    description: t("app.description"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: t("app.name"), statusBarStyle: "default" },
    icons: { icon: "/icons/192", apple: "/icons/192" },
  };
}

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await resolveLocale();
  const t = await getT("core", locale);
  const copy = shellCopy(locale);
  const titles = await Promise.all(
    modules.map(async (m) => ({
      name: m.manifest.name,
      href: `/${m.manifest.name}`,
      title: (await getT(m.manifest.name, locale))("title"),
    })),
  );
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <ThemeSync />
        <AppShell
          brand={t("app.name")}
          copy={copy}
          settings={t("nav.settings")}
          admin={t("nav.admin")}
          offline={t("offline.title")}
          modules={titles}
        >
          {children}
        </AppShell>
        <SwRegister message={t("sw.update")} action={t("sw.reload")} />
      </body>
    </html>
  );
}
