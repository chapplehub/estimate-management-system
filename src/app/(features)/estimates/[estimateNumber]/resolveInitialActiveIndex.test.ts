import { describe, expect, test } from "vitest";
import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { resolveInitialActiveIndex } from "./resolveInitialActiveIndex";

// この純関数が参照するのは各バリの status と配列順（index）のみ。最小形で表現する。
type V = Pick<VariationDTO, "status">;
const active: V = { status: "ACTIVE" };
const inactive: V = { status: "INACTIVE" };

describe("resolveInitialActiveIndex", () => {
  test("focusLast=true は末尾（最大番号）バリの index を返す", () => {
    // variations は variationNumber 昇順。追加・複製直後の新バリは末尾に来る（§A.2）。
    expect(resolveInitialActiveIndex([active, active, active], { focusLast: true })).toBe(2);
  });

  test("既定は最小番号の ACTIVE バリの index を返す（先頭が無効なら次の有効へ）", () => {
    expect(resolveInitialActiveIndex([inactive, active, active])).toBe(1);
  });

  test("既定で全バリが INACTIVE なら先頭（0）を返す", () => {
    expect(resolveInitialActiveIndex([inactive, inactive])).toBe(0);
  });

  test("focusLast=true でも空配列なら 0（末尾選択は要素があるときだけ）", () => {
    expect(resolveInitialActiveIndex([], { focusLast: true })).toBe(0);
  });
});
