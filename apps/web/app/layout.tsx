import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { modules } from "../lib/server";
import { SwRegister } from "./sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homegrown",
  description: "Unser Haushalt",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Homegrown" },
  icons: { icon: "/icons/192", apple: "/icons/192" },
};

export const viewport: Viewport = { themeColor: "#3f7d4e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" className="mr-auto text-base font-semibold">
              Homegrown
            </Link>
            {modules.map(({ manifest }) => (
              <Link key={manifest.name} href={`/${manifest.name}`} className="rounded-hg px-2 py-2 hover:bg-surface-muted">
                {manifest.title}
              </Link>
            ))}
            <Link href="/admin" className="rounded-hg px-2 py-2 text-fg-muted hover:bg-surface-muted">
              Verwaltung
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
        <SwRegister />
      </body>
    </html>
  );
}
