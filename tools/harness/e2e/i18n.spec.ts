import { expect, test } from "@playwright/test";

test("core.i18n.first-setup stores the household language; English is the default", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await page.goto("/setup");
  await expect(page.getByRole("button", { name: "Deutsch" })).toBeVisible();
});

test("core.i18n.member-override a member can switch to German without changing the household language", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("My language").selectOption("de");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("link", { name: "Verwaltung" })).toBeVisible();
  await expect(page.getByLabel("Sprache des Haushalts")).toHaveValue("en");

  await page.getByLabel("Meine Sprache").selectOption("");
  await page.getByRole("button", { name: "Speichern" }).nth(1).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
});
