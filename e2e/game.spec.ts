import { expect, test } from "@playwright/test";
import type {} from "../src/testAdapter";
test.beforeEach(async ({ page }) => {
  await page.goto("/?e2e=1");
  await page.waitForFunction(() => !!window.__cascade);
});
test("title, pair, keyboard, pause/resume and restart", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "PLAY →", exact: true }).click();
  await expect(page.locator("#viewport canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__cascade.snapshot().active.length))
    .toBe(2);
  await page.keyboard.press("a");
  await page.keyboard.press("w");
  await page.keyboard.press("e");
  let active = await page.evaluate(() => window.__cascade.snapshot().active);
  expect(active[0].pos[0]).toBe(0);
  expect(active[0].pos[2]).toBe(0);
  expect(active[1].pos[0]).toBe(1);
  await page.keyboard.press("q");
  await page.keyboard.press("d");
  await page.keyboard.press("s");
  active = await page.evaluate(() => window.__cascade.snapshot().active);
  expect(active[0].pos[0]).toBe(1);
  expect(active[0].pos[2]).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  const paused = await page.evaluate(() => window.__cascade.snapshot());
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__cascade.snapshot())).toEqual(
    paused,
  );
  await page.locator("#resume").click();
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.__cascade.snapshot().placed))
    .toBe(1);
  await page.locator("#restart").click();
  expect(await page.evaluate(() => window.__cascade.snapshot().placed)).toBe(0);
  expect(errors).toEqual([]);
});
for (const n of [1, 2, 3])
  test(`${n}-chain deterministic board`, async ({ page }) => {
    await page.getByRole("button", { name: "PLAY →", exact: true }).click();
    await page.evaluate((n) => window.__cascade.fixture(String(n)), n);
    await expect(page.locator("#prediction")).toContainText("RED CLEAR ×4");
    await page.keyboard.press("Space");
    await expect
      .poll(() => page.evaluate(() => window.__cascade.snapshot().chain), {
        timeout: 10000,
      })
      .toBe(n);
    await expect(page.locator("#score")).toHaveText(
      String([40, 120, 280][n - 1]).padStart(6, "0"),
    );
  });
test("perfect clear, game over, best persistence and play again", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY →", exact: true }).click();
  await page.evaluate(() => window.__cascade.fixture("perfect"));
  await page.keyboard.press("Space");
  await expect(page.locator("#score")).toHaveText("005040");
  await expect(page.locator("#chain")).toHaveText("PERFECT CLEAR +5000");
  await page.evaluate(() => window.__cascade.fixture("over"));
  await expect(page.getByRole("heading", { name: "GAME OVER" })).toBeVisible();
  await page.getByRole("button", { name: "PLAY AGAIN" }).click();
  await expect(page.locator("#score")).toHaveText("000000");
  await expect(page.locator("#best")).toHaveText("5040");
  await page.reload();
  await expect(page.locator("#best")).toHaveText("5040");
});
test("touch controls, camera presets and 320px fit", async ({ page }) => {
  await page.getByRole("button", { name: "PLAY →", exact: true }).click();
  await page.getByRole("button", { name: "左へ", exact: true }).click();
  expect(
    (await page.evaluate(() => window.__cascade.snapshot())).active[0].pos[0],
  ).toBe(0);
  for (const preset of ["FRONT", "RIGHT", "BACK", "LEFT", "TOP", "ISO"]) {
    const b = page.getByRole("button", { name: preset, exact: true });
    await b.click();
    await expect(b).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "配置", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__cascade.snapshot().placed))
    .toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("guided first clear and two-chain tutorial", async ({ page }) => {
  await page.getByRole("button", { name: "はじめての方へ" }).click();
  await page.keyboard.press("a");
  await page.keyboard.press("w");
  await page.keyboard.press("e");
  await page.keyboard.press("Space");
  await expect(page.locator("#tutorial")).toContainText("初CLEAR");
  await page.keyboard.press("Space");
  await expect(page.locator("#tutorial")).toContainText("2 CHAIN");
  await page.keyboard.press("Space");
  await expect(page.locator("#tutorial")).toContainText("チュートリアル完了");
  await page.getByRole("button", { name: "通常プレイへ" }).click();
  await expect(page.locator("#tutorial")).toBeHidden();
});
test("production has no debug API even with e2e query", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/?e2e=1");
  await expect(
    page.getByRole("button", { name: "PLAY →", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => typeof window.__cascade)).toBe("undefined");
});

test("capture playable board", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "PLAY →", exact: true }).click();
  await page.evaluate(() => window.__cascade.fixture("3"));
  await page.locator("#viewport canvas").waitFor();
  await page.screenshot({
    path: testInfo.outputPath("board.png"),
    fullPage: true,
  });
});
