import { test, expect } from "@playwright/test";

test("読み込みが完了し、キャンバスが表示される", async ({ page }) => {
  await page.goto("/");

  // ローディングメッセージが消えるまで待つ(WASMモジュールの初期化完了を待つ)。
  await expect(page.getByText("シミュレーションエンジンを読み込み中...")).not.toBeVisible({
    timeout: 10_000,
  });

  // エラーメッセージが表示されていないことを確認する。
  await expect(
    page.getByText("シミュレーションエンジンの読み込みに失敗しました", { exact: false }),
  ).not.toBeVisible();

  // キャンバスが描画されている。
  await expect(page.locator("canvas")).toBeVisible();
});
