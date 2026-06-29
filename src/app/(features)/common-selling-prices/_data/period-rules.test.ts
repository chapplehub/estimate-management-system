import { describe, expect, it } from "vitest";
import { authorityFor } from "./period-rules";

/**
 * 時点状態の派生（旧 classifyState）・重複判定（旧 overlaps/hasOverlap）は実BE接続（#473）で
 * BE（編集読みモデルの status 算出・集約の不変条件）へ移管したため、FE 側のテストは残置ヘルパ
 * `authorityFor`（BE status から操作可否を導く）のみを対象にする。
 */
describe("authorityFor", () => {
  it("将来行（future）は全項目編集可・適用終了不可・削除可", () => {
    expect(authorityFor("future")).toEqual({ editable: true, endDatable: false, deletable: true });
  });

  it("現在有効行（active）は編集不可・適用終了のみ可・削除不可", () => {
    expect(authorityFor("active")).toEqual({
      editable: false,
      endDatable: true,
      deletable: false,
    });
  });

  it("失効行（expired）は何もできない", () => {
    expect(authorityFor("expired")).toEqual({
      editable: false,
      endDatable: false,
      deletable: false,
    });
  });
});
