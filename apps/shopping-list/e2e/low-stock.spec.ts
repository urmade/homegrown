import { expect, test } from "@playwright/test";

test("shopping.e2e-low-stock pantry item below minimum lands on the shopping list from the UI", async ({ page }) => {
  const name = `Hafermilch ${Date.now()}`;
  await page.goto("/pantry");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Einheit").fill("Liter");
  await page.getByLabel("Bestand").fill("0");
  await page.getByLabel("Minimum").fill("2");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  const row = page.getByTestId("pantry-items").getByRole("listitem").filter({ hasText: name });
  await expect(row.getByText("knapp")).toBeVisible();

  await page.goto("/shopping-list");
  await page.getByRole("button", { name: "Aus Vorrat ergänzen" }).click();
  await expect(page.getByRole("status")).toContainText("aus dem Vorrat ergänzt");
  const entry = page.getByTestId("shopping-entries").getByRole("listitem").filter({ hasText: name });
  await expect(entry).toContainText("2 Liter");
  await expect(entry.getByText("Vorrat")).toBeVisible();

  await entry.getByRole("checkbox").click();
  await expect(entry.getByRole("checkbox")).toBeChecked();
});
