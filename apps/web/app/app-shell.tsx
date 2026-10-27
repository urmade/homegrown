"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AppBarProvider,
  IconButton,
  SegmentedControl,
  THEME_EVENT,
  readStoredThemePref,
  useAppBarExtras,
  type ThemePref,
} from "@homegrown/ui";
import type { ShellCopy } from "../lib/shell-copy";
import { iconFor, icons } from "./nav-icons";
import { nextThemePref, setThemePref } from "./theme-sync";

export type ModuleLink = { name: string; href: string; title: string };

function isTabRoot(path: string, modules: ModuleLink[]) {
  if (path === "/" || path === "/more") return true;
  return modules.some((m) => path === m.href);
}

function currentTitle(path: string, modules: ModuleLink[], copy: ShellCopy, settings: string, admin: string, offline: string) {
  if (path === "/") return copy.home;
  if (path === "/more") return copy.more;
  if (path === "/settings" || path.startsWith("/settings/")) return settings;
  if (path === "/admin" || path.startsWith("/admin/")) return admin;
  if (path === "/offline") return offline;
  const mod = modules.find((m) => path === m.href || path.startsWith(`${m.href}/`));
  return mod?.title ?? copy.home;
}

function navCurrent(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/more") {
    return path === "/more" || path.startsWith("/settings") || path.startsWith("/admin") || path === "/offline";
  }
  return path === href || path.startsWith(`${href}/`);
}

export function AppShell(props: {
  brand: string;
  copy: ShellCopy;
  settings: string;
  admin: string;
  offline: string;
  modules: ModuleLink[];
  children: ReactNode;
}) {
  const path = usePathname();
  if (path === "/setup") return <>{props.children}</>;
  return (
    <AppBarProvider>
      <ShellInner {...props} />
    </AppBarProvider>
  );
}

function ShellInner({
  brand,
  copy,
  settings,
  admin,
  offline,
  modules,
  children,
}: {
  brand: string;
  copy: ShellCopy;
  settings: string;
  admin: string;
  offline: string;
  modules: ModuleLink[];
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const extras = useAppBarExtras();
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    const read = () => setPref(readStoredThemePref());
    read();
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);
  const tabs = [{ href: "/", name: "home", title: copy.home }, ...modules, { href: "/more", name: "more", title: copy.more }];
  const title = currentTitle(path, modules, copy, settings, admin, offline);
  const pushed = !isTabRoot(path, modules);
  const themeOpts = [
    { value: "system", label: copy.themeSystem },
    { value: "light", label: copy.themeLight },
    { value: "dark", label: copy.themeDark },
  ];
  const onTheme = (v: string) => {
    const next = v as ThemePref;
    setPref(next);
    setThemePref(next);
  };

  const itemClass = (on: boolean) =>
    `flex h-11 items-center gap-3 rounded-[var(--hg-radius-md)] px-3 ${on ? "bg-primary-soft text-primary" : "text-fg"}`;

  return (
    <div className="flex min-h-dvh">
      <aside
        data-testid="app-sidebar"
        className="hg-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex"
      >
        <div className="hidden truncate px-4 py-5 text-[length:var(--hg-text-title)] font-bold lg:block">{brand}</div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 p-2">
          {tabs
            .filter((t) => t.href !== "/more")
            .map((item) => {
              const on = navCurrent(path, item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className={itemClass(on)}>
                  {iconFor(item.name)}
                  <span className="sr-only lg:not-sr-only lg:inline lg:truncate lg:text-[length:var(--hg-text-callout)] lg:font-medium">
                    {item.title}
                  </span>
                </Link>
              );
            })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-border p-2">
          <Link href="/settings" className={itemClass(navCurrent(path, "/settings"))}>
            {icons.settings}
            <span className="sr-only lg:not-sr-only lg:inline lg:truncate lg:text-[length:var(--hg-text-callout)] lg:font-medium">
              {settings}
            </span>
          </Link>
          <Link href="/admin" className={itemClass(navCurrent(path, "/admin"))}>
            {icons.admin}
            <span className="sr-only lg:not-sr-only lg:inline lg:truncate lg:text-[length:var(--hg-text-callout)] lg:font-medium">
              {admin}
            </span>
          </Link>
          <div className="hidden px-1 pt-2 lg:block">
            <SegmentedControl aria-label={copy.theme} value={pref} options={themeOpts} onChange={onTheme} />
          </div>
          <div className="lg:hidden">
            <IconButton aria-label={copy.theme} onClick={() => onTheme(nextThemePref(pref))}>
              {icons.settings}
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header data-testid="app-bar" className="hg-appbar sticky top-0 z-[var(--hg-z-sticky)] border-b border-border bg-surface md:hidden">
          <div className="flex h-full items-center gap-1 px-1">
            {pushed ? (
              <IconButton
                aria-label={copy.back}
                onClick={() => router.push(path.startsWith("/admin") || path.startsWith("/settings") ? "/more" : "/")}
              >
                {icons.back}
              </IconButton>
            ) : (
              <span className="w-11" />
            )}
            <h1 className="min-w-0 flex-1 truncate text-center text-[length:var(--hg-text-headline)] font-bold">
              {extras.title ?? title}
            </h1>
            {extras.trailing ?? <span className="w-11" />}
          </div>
        </header>
        <main className="hg-safe-main min-w-0 flex-1">{children}</main>
        <nav data-testid="app-tabs" className="hg-tabbar md:hidden">
          {tabs.map((item) => {
            const on = navCurrent(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-[49px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ${on ? "text-primary" : "text-fg-muted"}`}
              >
                {iconFor(item.name)}
                <span className="max-w-full truncate text-[length:var(--hg-text-tab)] leading-[13px] font-medium">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
