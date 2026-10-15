import { test, expect, type Page } from "@playwright/test";

const BLACK = "#111";

/** Fill color of a cell in the guided builder's 5x5 SVG grid. */
function cellFill(page: Page, row: number, col: number) {
  return page.locator("svg.select-none > g").nth(row * 5 + col).locator("rect");
}

test("toggling symmetry on applies to the next black-square click", async ({ page }) => {
  await page.goto("/create/guided");
  await page.getByRole("button", { name: "Toggle Black" }).click();
  await page.getByRole("checkbox", { name: "Symmetric" }).check();

  await page.locator("svg.select-none > g").nth(0).click();

  await expect(cellFill(page, 0, 0)).toHaveAttribute("fill", BLACK);
  await expect(cellFill(page, 4, 4)).toHaveAttribute("fill", BLACK);
});
