import { expect, test, type Page } from "@playwright/test";
import { loadManifests } from "../../../core/src/manifest";

const mods = loadManifests().map((m) => `/${m.manifest.name}`);
const ROUTES = ["/", "/settings", "/admin", "/admin/logs", "/admin/data-flow", "/offline", "/setup", "/more", ...mods];
const PHONES = [
  { w: 393, h: 852 },
  { w: 375, h: 667 },
] as const;

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement.scrollWidth - window.innerWidth;
    const main = document.querySelector("main");
    const inner = main ? main.scrollWidth - main.clientWidth : 0;
    return Math.max(doc, inner);
  });
}

test("mobile.overflow every route fits 393 and 375 without horizontal scroll", async ({ page }) => {
  for (const { w, h } of PHONES) {
    await page.setViewportSize({ width: w, height: h });
    for (const route of ROUTES) {
      const res = await page.goto(route, { waitUntil: "networkidle" });
      expect(res?.status(), `${route} @${w}`).toBeLessThan(400);
      const name = route === "/" ? "home" : route.slice(1).replaceAll("/", "_");
      await page.screenshot({ path: `artifacts/screenshots/mobile-${name}-${w}x${h}.png`, fullPage: true });
      expect(await overflow(page), `${route} scrolls horizontally at ${w}x${h}`).toBeLessThanOrEqual(0);
    }
  }
});

test("mobile.viewport-meta includes width=device-width and viewport-fit=cover", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");
  const content = (await page.locator('meta[name="viewport"]').getAttribute("content")) ?? "";
  expect(content).toMatch(/width=device-width/);
  expect(content).toMatch(/viewport-fit=cover/);
});

test("mobile.safe-area header and main padding use safe-area insets", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");
  const css = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .join("\n"),
  );
  expect(css).toMatch(/safe-area-inset-top/);
  expect(css).toMatch(/safe-area-inset-bottom/);
});

test("mobile.header-single-row app bar is one 52px row at 375 and 393", async ({ page }) => {
  for (const { w, h } of PHONES) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const bar = page.getByTestId("app-bar");
    await expect(bar).toBeVisible();
    const height = await bar.evaluate((el) => el.getBoundingClientRect().height);
    expect(height, `app bar height @${w}`).toBe(52);
    await expect(bar.locator("h1")).toHaveCSS("text-overflow", "ellipsis");
    expect(await bar.getByRole("link").count(), `app-bar links @${w}`).toBe(0);
  }
});

test("mobile.tab-bar Start, registry modules and More in one row under 768px", async ({ page }) => {
  for (const { w, h } of PHONES) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const tabs = page.getByTestId("app-tabs");
    await expect(tabs, `tabs @${w}`).toBeVisible();
    await expect(tabs.getByRole("link")).toHaveCount(2 + mods.length);
    for (const name of ["Start", "More"]) {
      const link = tabs.getByRole("link", { name, exact: true });
      await expect(link, `${name} @${w}`).toBeVisible();
      const box = await link.boundingBox();
      expect(box && box.height >= 44, `${name} height @${w}`).toBeTruthy();
    }
    const boxes = await tabs.getByRole("link").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y));
    expect(Math.max(...boxes) - Math.min(...boxes), `tab wrap @${w}`).toBeLessThanOrEqual(2);
    expect(await overflow(page), `tabs overflow @${w}`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/admin/logs");
  await expect(page.getByTestId("app-tabs").getByRole("link", { name: "More", exact: true })).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");
  await expect(page.getByTestId("app-tabs")).toBeHidden();
  await expect(page.getByTestId("app-sidebar").getByRole("link", { name: "Start" })).toBeVisible();
});

test("mobile.tap-targets app-bar back and tab links are at least 44px tall", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");
  const tabLinks = page.getByTestId("app-tabs").getByRole("link");
  const count = await tabLinks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await tabLinks.nth(i).boundingBox();
    expect(box && box.height >= 44, `tab ${i} height`).toBeTruthy();
  }
  await page.goto("/settings");
  const back = page.getByTestId("app-bar").getByRole("button").first();
  const backBox = await back.boundingBox();
  expect(backBox && backBox.height >= 44 && backBox.width >= 44, "app-bar back").toBeTruthy();
});

test("mobile.input-font settings selects are at least 16px", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/settings");
  const select = page.locator("select").first();
  expect(await select.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});

test("mobile.dialog-fit App-info dialog stays within the viewport at 393", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/more");
  await page.getByRole("button", { name: "App info" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const { height, top, bottom } = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { height: r.height, top: r.top, bottom: r.bottom };
  });
  expect(height).toBeLessThanOrEqual(852);
  expect(top).toBeGreaterThanOrEqual(-1);
  expect(bottom).toBeLessThanOrEqual(853);
});
