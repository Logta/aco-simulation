import { test, expect } from "@playwright/test";

test.describe("ACOシミュレーション", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("シミュレーションエンジンを読み込み中...")).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test("キャンバスをクリックすると食料が追加され、見た目が変化する(一時停止中)", async ({ page }) => {
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();

    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvasのboundingBoxが取得できません");
    // アプリ起動直後はisRunning: falseなので、ここではまだ「開始」を押さない
    // (シミュレーション実行中だとアリの移動そのものでキャンバスが変化し続け、
    // クリックによる食料追加が原因かどうかを切り分けられなくなる)。
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);

    const after = await canvas.screenshot();
    expect(before.equals(after)).toBe(false);
  });

  test("「開始」を押すとシミュレーションが進行し、キャンバスが時間経過で変化する", async ({ page }) => {
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();

    await page.getByRole("button", { name: "開始" }).click();
    await page.waitForTimeout(1_000);

    const after = await canvas.screenshot();
    expect(before.equals(after)).toBe(false);

    // ボタンラベルが「一時停止」に切り替わっている。
    await expect(page.getByRole("button", { name: "一時停止" })).toBeVisible();
  });

  test("「リセット」を押してもエラーにならず描画が継続する", async ({ page }) => {
    await page.getByRole("button", { name: "開始" }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "リセット" }).click();
    await page.waitForTimeout(200);

    // リセット後もキャンバスは表示され続け、エラーメッセージは出ない。
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("シミュレーションエンジンの読み込みに失敗しました", { exact: false })).not.toBeVisible();
  });

  test("アリ数スライダーをキーボードで操作すると値が変化する", async ({ page }) => {
    const antSliderThumb = page.locator("#antCount").locator('[role="slider"]');
    await antSliderThumb.focus();

    const before = await antSliderThumb.getAttribute("aria-valuenow");
    await page.keyboard.press("ArrowRight");
    const after = await antSliderThumb.getAttribute("aria-valuenow");

    expect(Number(after)).toBeGreaterThan(Number(before ?? "0"));
  });

  test("「餌を追加」ボタンを押すとキャンバスが変化する", async ({ page }) => {
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();

    await page.getByRole("button", { name: "餌を追加" }).click();
    await page.waitForTimeout(200);

    const after = await canvas.screenshot();
    expect(before.equals(after)).toBe(false);
  });
});
