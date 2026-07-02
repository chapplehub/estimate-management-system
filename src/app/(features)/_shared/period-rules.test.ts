import { describe, expect, it } from "vitest";
import { authorityFor } from "./period-rules";

/**
 * 適用期間の状態別操作権限（純粋述語）の単体テスト。
 *
 * 時点状態の派生・重複判定は BE（編集読みモデルの status 算出・集約の不変条件）が担うため、
 * FE 側には行ごとの操作可否（編集／改定／適用終了／削除ボタンの出し分け）を導く `authorityFor`
 * だけを残す。入力は集約非依存の中立型 `PeriodStatus`（`future`/`active`/`expired`）で、
 * 共通売単価・原価・得意先別販売単価のいずれの編集読みモデルからもそのまま渡せる（#503 で昇格）。
 */
describe("authorityFor", () => {
  it("将来行（future）は全項目編集可・適用終了不可・削除可・改定不可", () => {
    expect(authorityFor("future")).toEqual({
      editable: true,
      endDatable: false,
      deletable: true,
      revisable: false,
    });
  });

  it("現在有効行（active）は編集不可・適用終了のみ可・削除不可・改定可", () => {
    expect(authorityFor("active")).toEqual({
      editable: false,
      endDatable: true,
      deletable: false,
      revisable: true,
    });
  });

  it("失効行（expired）は何もできない", () => {
    expect(authorityFor("expired")).toEqual({
      editable: false,
      endDatable: false,
      deletable: false,
      revisable: false,
    });
  });
});
