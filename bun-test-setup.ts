import { JSDOM } from "jsdom";
import "@testing-library/jest-dom";
import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
  resources: "usable",
});

global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Text = dom.window.Text;
global.getComputedStyle = dom.window.getComputedStyle;

// vitest実行時はsrc/test/setup.tsのafterEach(cleanup)がレンダリング済みの
// フックやコンポーネントを各テスト後にアンマウントするが、bun testはpreloadで
// 読み込まれるこのファイルしか共有セットアップを持たない。ここでcleanup()を
// 呼ばないと、renderHook/renderの結果がテストファイルをまたいでマウントされ
// たままになり(bun testは全テストファイルを1つのプロセス・1つのモジュール
// レジストリで実行するため)、useEffect内のrequestAnimationFrameループ等が
// 動き続けて他のテストファイルの状態を汚染してしまう。
afterEach(() => {
  cleanup();
});
