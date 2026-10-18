import { expect, test } from "@playwright/test";

test("shopping.e2e-low-stock pantry item below minimum lands on the shopping list from the UI", async ({ page }) => {
  const name = `Oat milk ${Date.now()}`;
  await page.goto("/pantry");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Unit").fill("l");
  await page.getByLabel("In stock").fill("0");
  await page.getByLabel("Minimum").fill("2");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = page.getByTestId("pantry-items").getByRole("listitem").filter({ hasText: name });
  await expect(row.getByText("low", { exact: true })).toBeVisible();

  await page.goto("/shopping-list");
  await page.getByRole("button", { name: "Add from pantry" }).click();
  await expect(page.getByRole("status")).toContainText("from the pantry");
  const entry = page.getByTestId("shopping-entries").getByRole("listitem").filter({ hasText: name });
  await expect(entry).toContainText("2 l");
  await expect(entry.getByText("Pantry", { exact: true })).toBeVisible();

  await entry.getByRole("checkbox").click();
  await expect(entry.getByRole("checkbox")).toBeChecked();
});
