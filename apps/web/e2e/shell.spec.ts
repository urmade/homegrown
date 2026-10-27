import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { moduleRoutes } from "./module-routes";

const mods = moduleRoutes();
const SHELL = ["/", "/more", "/settings", ...mods] as const;
const CHROME = ["/", "/more", "/settings"] as const;
const PHONE = { width: 393, height: 852 };
const DESKTOP = { width: 1440, height: 900 };

function contrast(a: string, b: string) {
  const hex = (c: string) => {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    return [0, 0, 0];
  };
  const lum = (c: string) => {
    const [r, g, b] = hex(c).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - window.innerWidth;
  });
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `artifacts/screenshots/${name}.png`, fullPage: true });
}

test("ux.a1.bar app bar is one 52px row on phone and PageHeader is 64px on desktop", async ({ page }) => {
  for (const route of SHELL) {
    await page.setViewportSize(PHONE);
    await page.goto(route, { waitUntil: "networkidle" });
    const bar = page.getByTestId("app-bar");
    await expect(bar, route).toBeVisible();
    const h = await bar.evaluate((el) => el.getBoundingClientRect().height);
    expect(h, `${route} app bar`).toBe(52);
    const h1 = bar.locator("h1");
    await expect(h1).toHaveCSS("text-overflow", "ellipsis");
    expect(await page.locator("h1").filter({ visible: true }).count()).toBe(1);

    await page.setViewportSize(DESKTOP);
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.getByTestId("app-bar")).toBeHidden();
    await expect(page.getByTestId("app-tabs")).toBeHidden();
    const header = page.locator("main header").first();
    await expect(header, route).toBeVisible();
    const ph = await header.evaluate((el) => el.getBoundingClientRect().height);
    expect(ph, `${route} PageHeader`).toBe(64);
  }
  await page.setViewportSize(PHONE);
  await page.goto("/setup");
  await expect(page.getByTestId("app-bar")).toHaveCount(0);
  await expect(page.getByTestId("app-tabs")).toHaveCount(0);
  await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(page.getByText("Which language should the household use?", { exact: false })).toBeVisible();
});

test("ux.a2.overflow no horizontal scroll on shell routes at 393 and 1440 light and dark", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const size of [PHONE, DESKTOP]) {
      await page.setViewportSize(size);
      for (const route of SHELL) {
        await page.goto(route, { waitUntil: "networkidle" });
        expect(await overflow(page), `${route} ${size.width} ${scheme}`).toBeLessThanOrEqual(0);
      }
    }
  }
});

test("ux.a3.tabbar Start then registry modules then More on phone, hidden on desktop", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");
  const tabs = page.getByTestId("app-tabs");
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link")).toHaveCount(2 + mods.length);
  await expect(tabs.getByRole("link", { name: "Start" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "More" })).toBeVisible();
  const h = await tabs.evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(49);
  const pad = await page.locator("main").evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(49);
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  await expect(page.getByTestId("app-tabs")).toBeHidden();
});

test("ux.a4.sidebar 232px at 1440 with no top nav; 72px rail at 820", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  const side = page.getByTestId("app-sidebar");
  await expect(side).toBeVisible();
  expect(await side.evaluate((el) => el.getBoundingClientRect().width)).toBe(232);
  await expect(side.getByRole("link", { name: "Start" })).toBeVisible();
  await expect(side.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(side.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(page.locator("body > header nav")).toHaveCount(0);

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");
  expect(await page.getByTestId("app-sidebar").evaluate((el) => el.getBoundingClientRect().width)).toBe(72);
  await expect(page.getByTestId("app-tabs")).toBeHidden();
});

test("ux.more lists appearance settings admin and app info; back on pushed screens", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/more");
  await expect(page.getByText("Appearance", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await page.getByRole("button", { name: "App info" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/settings");
  await expect(page.getByTestId("app-bar").getByRole("button", { name: "Back" })).toBeVisible();
});

test("ux.ui.dialog App-info native dialog has an accessible name and closes on overlay", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/more");
  await page.getByRole("button", { name: "App info" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName("App info");
  const box = await dialog.evaluate((el) => el.getBoundingClientRect());
  expect(box.height).toBeLessThanOrEqual(852);
  await page.locator("dialog").click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeHidden();
});

test("ux.a18.axe no serious or critical on shell routes light and dark", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const size of [PHONE, DESKTOP]) {
      await page.setViewportSize(size);
      for (const route of SHELL) {
        await page.goto(route, { waitUntil: "networkidle" });
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(
          serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
          `${route} ${size.width} ${scheme}`,
        ).toEqual([]);
      }
    }
  }
});

test("ux.a19.hit visible shell chrome plus more and settings controls are at least 44px", async ({ page }) => {
  for (const size of [PHONE, DESKTOP]) {
    await page.setViewportSize(size);
    for (const route of CHROME) {
      await page.goto(route, { waitUntil: "networkidle" });
      const bad = await page.evaluate(() => {
        const roots = [
          document.querySelector("[data-testid=app-bar]"),
          document.querySelector("[data-testid=app-tabs]"),
          document.querySelector("[data-testid=app-sidebar]"),
          document.querySelector("main"),
        ].filter(Boolean) as HTMLElement[];
        const seen = new Set<HTMLElement>();
        const nodes: HTMLElement[] = [];
        for (const root of roots) {
          for (const el of root.querySelectorAll<HTMLElement>("button, a, input, select, [role=button]")) {
            if (seen.has(el)) continue;
            seen.add(el);
            nodes.push(el);
          }
        }
        return nodes.flatMap((el) => {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          if (st.display === "none" || st.visibility === "hidden" || r.width === 0 || r.height === 0) return [];
          if (r.height + 0.5 < 44 || r.width + 0.5 < 44)
            return [`${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.trim()?.slice(0, 24)} ${r.width}x${r.height}`];
          return [];
        });
      });
      expect(bad, `${route} @${size.width}`).toEqual([]);
    }
  }
});

test("ux.a20.input settings fields are at least 16px", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/settings");
  const select = page.locator("select").first();
  expect(await select.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});

test("ux.a21.keyboard focus ring, dialog trap and Escape", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/more");
  const trigger = page.getByRole("button", { name: "App info" });
  await trigger.focus();
  const ring = await trigger.evaluate((el) => {
    el.focus();
    const s = getComputedStyle(el);
    return { width: s.outlineWidth, color: s.outlineColor };
  });
  expect(Number.parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("ux.a22.theme system follows OS and light/dark persist with resolved data-theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.content()).toContain("hg-theme");
  await page.setViewportSize(PHONE);
  await page.goto("/more");
  await page.getByRole("tablist", { name: "Appearance" }).getByRole("tab", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("tablist", { name: "Appearance" }).getByRole("tab", { name: "Dark" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("tablist", { name: "Appearance" }).getByRole("tab", { name: "System" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("ux.a24.border input border contrasts at least 3:1", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/settings");
    const { border, bg } = await page
      .locator("select")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { border: s.borderTopColor, bg: s.backgroundColor };
      });
    expect(contrast(border, bg), scheme).toBeGreaterThanOrEqual(3);
  }
});

test("ux.a26.lang html lang follows locale and German shell copy appears", async ({ page }) => {
  const reset = async () => {
    await page.goto("/settings");
    const member = page.getByLabel("My language").or(page.getByLabel("Meine Sprache"));
    if (await member.count()) {
      await member.selectOption("");
      const save = page.getByRole("button", { name: /Save|Speichern/ }).nth(1);
      if (await save.count()) await save.click();
    }
  };
  await reset();
  try {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Start" }).first()).toBeVisible();
    await page.goto("/settings");
    await page.getByLabel("My language").selectOption("de");
    await page.getByRole("button", { name: "Save" }).nth(1).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await page.setViewportSize(PHONE);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Start" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Mehr" })).toBeVisible();
    await page.goto("/more");
    await expect(page.getByText("Darstellung").first()).toBeVisible();
  } finally {
    await reset();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  }
});

test("ux.theme.resolver boot script writes one theme-color; screenshots home light and dark", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await screenshot(page, "home-393-light");
  const lightMeta = await page.locator('meta[name="theme-color"]').count();
  expect(lightMeta).toBe(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#FFFFFF");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await screenshot(page, "home-393-dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.locator('meta[name="theme-color"]').count()).toBe(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#161A21");
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await screenshot(page, "home-1440-light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await screenshot(page, "home-1440-dark");
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
  expect(css).not.toMatch(/#f7f6f1/i);
  expect(css).not.toMatch(/prefers-color-scheme: light/);
});

test("ux.toast-theme Toast and SW toast follow dark tokens", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const colors = await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    const probe = (cls: string, tone?: string) => {
      const el = document.createElement("div");
      el.className = cls;
      el.setAttribute("role", "status");
      if (tone) el.setAttribute("data-tone", tone);
      document.body.appendChild(el);
      const s = getComputedStyle(el);
      const out = { bg: s.backgroundColor, fg: s.color };
      el.remove();
      return out;
    };
    return {
      toast: probe("hg-toast"),
      sw: probe("hg-sw-toast"),
      banner: probe("hg-banner"),
      danger: probe("hg-banner", "danger"),
    };
  });
  for (const [name, c] of Object.entries(colors)) {
    expect(c.bg, name).not.toMatch(/rgb\(\s*255,\s*255,\s*255\s*\)/);
    expect(c.bg, name).not.toBe("rgba(0, 0, 0, 0)");
    if (name !== "danger") expect(c.fg, name).not.toMatch(/rgb\(\s*17,\s*24,\s*39\s*\)/);
  }
});
