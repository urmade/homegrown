import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { responsiveExceptions, routes } from "./routes";

const WIDTHS = [390, 820, 1280];

/** check-responsive: screenshot every route at phone, tablet and desktop; no horizontal overflow; no serious axe issues. */
for (const route of routes)
  for (const width of WIDTHS)
    test(`responsive ${route} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const res = await page.goto(route, { waitUntil: "networkidle" });
      expect(res?.status(), `${route} status`).toBeLessThan(400);
      const name = route === "/" ? "home" : route.slice(1).replaceAll("/", "_");
      await page.screenshot({ path: `artifacts/screenshots/${name}-${width}.png`, fullPage: true });

      if (!responsiveExceptions.has(route)) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${route} scrolls horizontally at ${width}px`).toBeLessThanOrEqual(0);
      }

      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `${route} axe @${width}`).toEqual([]);
    });
