import { expect, test } from "@playwright/test";

const SYNC_TAG = "workbox-background-sync:writes-shopping-list";

test("shopping.offline-replay an entry added offline is queued and replayed by background sync", async ({ page, context, baseURL }) => {
  const title = `Coffee ${Date.now()}`;
  const titles = async () =>
    ((await (await page.request.post("/api/fn/shopping-list/listEntries", { data: {} })).json()) as { title: string }[]).map((e) => e.title);

  await page.goto("/shopping-list");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.getByLabel("Item").fill(title);
  await page.getByRole("button", { name: "Add to list" }).click();
  await expect(page.getByRole("status")).toContainText("Saved offline");
  await expect(page.getByTestId("shopping-entries")).toContainText(title);
  const queued = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("workbox-background-sync");
        req.onsuccess = () => {
          const tx = req.result.transaction("requests", "readonly");
          const count = tx.objectStore("requests").count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );
  expect(queued).toBeGreaterThan(0);
  expect(await titles()).not.toContain(title);
  await context.setOffline(false);

  // Chromium fires "sync" on reconnect; dispatching it too (like the DevTools Sync button) removes the timing dependency.
  const cdp = await context.newCDPSession(page);
  const registrationId = new Promise<string>((resolve) =>
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const reg = registrations.find((r) => !r.isDeleted && r.scopeURL.startsWith(baseURL!));
      if (reg) resolve(reg.registrationId);
    }),
  );
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.dispatchSyncEvent", { origin: new URL(baseURL!).origin, registrationId: await registrationId, tag: SYNC_TAG, lastChance: false });

  await expect.poll(titles, { timeout: 15_000 }).toContain(title);
  await page.reload();
  await expect(page.getByTestId("shopping-entries").getByRole("listitem").filter({ hasText: title })).toHaveCount(1);
});
