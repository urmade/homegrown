"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@homegrown/ui";

/** Registers the one core service worker and offers a reload when a new version is waiting. */
export function SwRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const accepted = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => accepted.current && location.reload());
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
    });
  }, []);

  if (!waiting) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between gap-3 rounded-hg border border-border bg-surface p-3 shadow-lg">
      <span className="text-sm">Neue Version verfügbar.</span>
      <Button
        onClick={() => {
          accepted.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Neu laden
      </Button>
    </div>
  );
}
