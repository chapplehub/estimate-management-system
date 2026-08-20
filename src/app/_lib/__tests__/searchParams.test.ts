import { describe, expect, it } from "vitest";
import { getArrayParam } from "@/app/_lib/searchParams";

describe("getArrayParam（繰り返しパラメータを string[] へ正規化）", () => {
  it("繰り返しパラメータ（?state=A&state=B）は string[] として渡ってくるのでそのまま配列で返す", () => {
    expect(getArrayParam({ state: ["PENDING", "APPROVED"] }, "state")).toEqual([
      "PENDING",
      "APPROVED",
    ]);
  });

  it("単一値（?state=A）は string として渡ってくるので 1 要素配列へ包む", () => {
    expect(getArrayParam({ state: "PENDING" }, "state")).toEqual(["PENDING"]);
  });

  it("キーが無いときは undefined（＝絞り込まない）を返す", () => {
    expect(getArrayParam({}, "state")).toBeUndefined();
  });

  it("空文字のみのときは undefined を返す（空要素を捨てて残りが無い）", () => {
    expect(getArrayParam({ state: ["", "  "] }, "state")).toBeUndefined();
  });
});
