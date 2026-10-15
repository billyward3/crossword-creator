import { test, expect } from "@playwright/test";

const EDITOR_KEY = "crossword-editor-state";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(
      key,
      JSON.stringify({
        grid: [["O", "C", "E", "A", "N"]],
        clues: { "0,0,across": "Big water" },
        userWords: ["OCEAN"],
        fillWords: [],
        title: "",
      })
    );
  }, EDITOR_KEY);
  await page.goto("/create/edit");
  // Loads as a 5x9 grid: two gutter rows and columns around OCEAN.
  await expect(page.getByText("Big water")).toBeVisible();
});

const cells = (page: import("@playwright/test").Page) =>
  page.locator(".inline-grid > button");

test("clues stay attached when typing in the gutter grows the grid", async ({ page }) => {
  // Top-left gutter cell above the O. Typing there forces two more rows
  // of top padding, shifting OCEAN down.
  await cells(page).nth(2).click();
  await page.keyboard.press("X");

  await expect(cells(page)).toHaveCount(7 * 9);
  await expect(page.getByText("Big water")).toBeVisible();
  await expect(page.getByText("Add clue")).toHaveCount(0); // a lone X is not a word
});

test("clues stay attached when a black square grows the grid", async ({ page }) => {
  await page.getByRole("button", { name: "Black Square" }).click();
  await cells(page).nth(2).click();

  await expect(cells(page)).toHaveCount(7 * 9);
  await expect(page.getByText("Big water")).toBeVisible();
  await expect(page.getByText("Add clue")).toHaveCount(0);
});

test("undo after a grid-growing edit keeps clues attached", async ({ page }) => {
  await cells(page).nth(2).click();
  await page.keyboard.press("X");
  await page.getByRole("button", { name: "Undo" }).click();

  await expect(cells(page)).toHaveCount(5 * 9);
  await expect(page.getByText("Big water")).toBeVisible();
  await expect(page.getByText("Add clue")).toHaveCount(0);
});

test("the cursor keeps advancing correctly after the grid grows", async ({ page }) => {
  await cells(page).nth(2).click();
  await page.keyboard.press("X");
  await page.keyboard.press("Y");

  const rows = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).grid.map((r: string[]) => r.join("")),
    EDITOR_KEY
  );
  expect(rows).toContain("XY");
});
