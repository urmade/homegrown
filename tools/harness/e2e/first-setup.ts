import { chromium, type FullConfig } from "@playwright/test";

/**
 * A fresh install asks for the household language before anything else; the suite picks English through
 * that real flow (core.i18n.first-setup). On a reused local database that already has a language it does nothing.
 */
export default async function firstSetup(config: FullConfig) {
  const { baseURL, launchOptions } = config.projects[0]!.use;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ baseURL });
  try {
    await page.goto("/");
    if (new URL(page.url()).pathname === "/setup") {
      await page.getByRole("button", { name: "English" }).click();
      await page.waitForURL((u) => u.pathname === "/");
    }
  } finally {
    await browser.close();
  }
}
