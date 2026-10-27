"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Card, SegmentedControl, THEME_EVENT, readStoredThemePref, useAppBar, type ThemePref } from "@homegrown/ui";
import type { ShellCopy } from "../../lib/shell-copy";
import { setThemePref } from "../theme-sync";

export function MoreView({
  copy,
  settings,
  admin,
  appInfoText,
}: {
  copy: ShellCopy;
  settings: string;
  admin: string;
  appInfoText: string;
}) {
  const [pref, setPref] = useState<ThemePref>("system");
  const [info, setInfo] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useAppBar({ title: copy.more }, [copy.more]);
  useEffect(() => {
    const read = () => setPref(readStoredThemePref());
    read();
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (info) {
      if (!el.open) el.showModal();
    } else if (el.open) el.close();
  }, [info]);
  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="mb-3 text-[length:var(--hg-text-footnote)] font-semibold text-fg-muted">{copy.appearance}</h2>
        <SegmentedControl
          aria-label={copy.appearance}
          value={pref}
          options={[
            { value: "system", label: copy.themeSystem },
            { value: "light", label: copy.themeLight },
            { value: "dark", label: copy.themeDark },
          ]}
          onChange={(v) => {
            const next = v as ThemePref;
            setPref(next);
            setThemePref(next);
          }}
        />
      </Card>
      <Card className="overflow-hidden p-0">
        <Link href="/settings" className="flex min-h-11 items-center px-4 text-base">
          {settings}
        </Link>
        <Link href="/admin" className="flex min-h-11 items-center px-4 text-base">
          {admin}
        </Link>
        <button
          ref={trigger}
          type="button"
          className="flex min-h-11 w-full items-center px-4 text-left text-base"
          onClick={() => setInfo(true)}
        >
          {copy.appInfo}
        </button>
      </Card>
      <dialog
        ref={dialog}
        className="hg-more-dialog"
        aria-labelledby="hg-app-info-title"
        onClose={() => {
          setInfo(false);
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const nodes = [
            ...e.currentTarget.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"),
          ].filter((el) => !el.hasAttribute("disabled"));
          if (nodes.length === 0) return;
          const first = nodes[0]!;
          const last = nodes[nodes.length - 1]!;
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="hg-more-dialog-body">
          <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-border-strong md:hidden" />
          <h2 id="hg-app-info-title" className="text-[length:var(--hg-text-headline)] font-bold">
            {copy.appInfo}
          </h2>
          <p className="mt-3 text-base">{appInfoText}</p>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
              {copy.close}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
