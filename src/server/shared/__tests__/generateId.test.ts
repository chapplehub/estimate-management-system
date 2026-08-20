import { describe, expect, it } from "vitest";
import { generateId } from "../generateId";

const UUIDV7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateId", () => {
  it("UUIDv7フォーマットの文字列を返す", () => {
    const id = generateId();
    expect(id).toMatch(UUIDV7_REGEX);
  });

  it("呼び出しごとに異なるIDを生成する", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("生成順に辞書順ソートが可能", async () => {
    const first = generateId();
    // タイムスタンプが進むのを待つ
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = generateId();
    expect(first < second).toBe(true);
  });
});
