import { expect, test, type Page } from "@playwright/test";
import { offlineRoutes } from "./routes";

async function controlled(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

/** check-pwa: installability via manifest + service worker (Lighthouse dropped its PWA category in v12). */
test("pwa installable: manifest and icons", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: expect.any(String), short_name: expect.any(String), start_url: "/", display: "standalone" });
  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find((i: { sizes: string; purpose?: string }) => i.sizes === size && (i.purpose ?? "any").includes("any"));
    expect(icon, `icon ${size}`).toBeTruthy();
    const res = await request.get(icon.src);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

test("pwa installable: service worker registers and controls the page", async ({ page }) => {
  await controlled(page);
});

test("pwa never caches admin, logs or health", async ({ page }) => {
  await controlled(page);
  for (const path of ["/admin", "/admin/logs", "/health"]) await page.goto(path, { waitUntil: "networkidle" });
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    return urls;
  });
  expect(cached.filter((u) => /^\/(admin|api\/auth|api\/admin)(\/|$)|\/health$/.test(u))).toEqual([]);
});

test("pwa undeclared routes show the offline notice", async ({ page, context }) => {
  await controlled(page);
  await context.setOffline(true);
  await page.goto("/", { waitUntil: "domcontentloaded" }).catch(() => {});
  await expect(page.getByRole("heading", { name: "Offline" })).toBeVisible();
  await context.setOffline(false);
});

for (const route of offlineRoutes)
  test(`pwa offline route ${route} works with the network off`, async ({ page, context }) => {
    await controlled(page);
    await page.goto(route, { waitUntil: "networkidle" });
    const heading = await page.getByRole("heading", { level: 1 }).textContent();
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading!);
    await context.setOffline(false);
  });
