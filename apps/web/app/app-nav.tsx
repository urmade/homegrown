"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav({
  variant,
  titles,
  settings,
  admin,
}: {
  variant: "header" | "tabs";
  titles: readonly (readonly [string, string])[];
  settings: string;
  admin: string;
}) {
  const path = usePathname();
  const items = [
    ...titles.map(([name, title]) => ({
      href: `/${name}`,
      label: title,
      current: path === `/${name}` || path.startsWith(`/${name}/`),
    })),
    { href: "/settings", label: settings, current: path === "/settings" || path.startsWith("/settings/") },
    { href: "/admin", label: admin, current: path === "/admin" || path.startsWith("/admin/") },
  ];
  if (variant === "header") {
    return (
      <div className="ml-auto hidden items-center gap-x-4 md:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-hg px-2 text-fg-muted hover:bg-surface-muted"
          >
            {item.label}
          </Link>
        ))}
      </div>
    );
  }
  return (
    <nav data-testid="app-tabs" className="hg-safe-tabs flex shrink-0 border-t border-border bg-surface md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center px-1 text-center text-xs font-medium text-fg-muted aria-[current=page]:text-fg"
        >
          <span className="min-w-0 w-full truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
