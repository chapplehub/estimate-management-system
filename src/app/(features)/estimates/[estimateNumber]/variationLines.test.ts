import { describe, expect, it } from "vitest";
import {
  createWorkingLine,
  insertBelow,
  removeLine,
  reorderLines,
  toLinePayload,
  type WorkingLine,
} from "./variationLines";

const product = {
  id: "prod-1",
  code: "P001",
  name: "商品A",
  category: "INDIVIDUAL",
  unit: "個",
};

describe("createWorkingLine（商品スナップショット＋新規行既定値）", () => {
  it("商品名・単位・コード・区分をスナップショットし、既定値で行を作る", () => {
    const line = createWorkingLine("row-1", product);

    expect(line).toMatchObject({
      rowId: "row-1",
      productId: "prod-1",
      productCode: "P001",
      productCategory: "INDIVIDUAL",
      itemName: "商品A",
      unit: "個",
      quantity: 1, // 既定 数量1
      unitPrice: 0, // 既定 単価0（販売単価マスタ未確定＝要入力）
      discountRate: 1.0, // 既定 掛率1.0（値引なし）
      itemDiscount: 0, // 既定 値引0
      customerMemo: "",
      internalMemo: "",
    });
  });

  it("数値項目を上書きできる（周辺サジェストの数量＝relation の quantity）", () => {
    const line = createWorkingLine("row-1", product, { quantity: 3 });

    expect(line.quantity).toBe(3);
    expect(line.discountRate).toBe(1.0); // 他は新規行既定のまま
  });
});

/** rowId だけ持つ最小の作業行（並べ替え・挿入位置の検証用）。 */
function row(rowId: string): WorkingLine {
  return createWorkingLine(rowId, product);
}

describe("insertBelow（アクティブ行の直下に挿入・なければ末尾）", () => {
  it("アクティブ行の直下へ挿入する", () => {
    const lines = [row("A"), row("B"), row("C")];
    const result = insertBelow(lines, "B", [row("X")]);

    expect(result.map((l) => l.rowId)).toEqual(["A", "B", "X", "C"]);
  });

  it("アクティブ行が無い（null）ときは末尾へ追加する", () => {
    const lines = [row("A"), row("B")];
    const result = insertBelow(lines, null, [row("X")]);

    expect(result.map((l) => l.rowId)).toEqual(["A", "B", "X"]);
  });

  it("アクティブ行が見つからないときも末尾へ追加する", () => {
    const lines = [row("A"), row("B")];
    const result = insertBelow(lines, "Z", [row("X")]);

    expect(result.map((l) => l.rowId)).toEqual(["A", "B", "X"]);
  });

  it("元配列を破壊しない（新しい配列を返す）", () => {
    const lines = [row("A"), row("B")];
    insertBelow(lines, "A", [row("X")]);

    expect(lines.map((l) => l.rowId)).toEqual(["A", "B"]);
  });
});

describe("removeLine（rowId の行を取り除く）", () => {
  it("指定行を取り除く", () => {
    const lines = [row("A"), row("B"), row("C")];
    expect(removeLine(lines, "B").map((l) => l.rowId)).toEqual(["A", "C"]);
  });

  it("存在しない rowId なら変化しない", () => {
    const lines = [row("A"), row("B")];
    expect(removeLine(lines, "Z").map((l) => l.rowId)).toEqual(["A", "B"]);
  });
});

describe("reorderLines（D&D 並べ替え・index ベース）", () => {
  it("from から to へ移動する", () => {
    const lines = [row("A"), row("B"), row("C")];
    expect(reorderLines(lines, 0, 2).map((l) => l.rowId)).toEqual(["B", "C", "A"]);
  });
});

describe("toLinePayload（JSON 往復用に schema 項目へ絞る）", () => {
  it("client 専用列（rowId・productCode・productCategory）を落とす", () => {
    const payload = toLinePayload([row("A")]);

    expect(payload).toHaveLength(1);
    expect(payload[0]).not.toHaveProperty("rowId");
    expect(payload[0]).not.toHaveProperty("productCode");
    expect(payload[0]).not.toHaveProperty("productCategory");
    expect(payload[0]).toMatchObject({
      productId: "prod-1",
      itemName: "商品A",
      unit: "個",
      quantity: 1,
      unitPrice: 0,
      discountRate: 1.0,
      itemDiscount: 0,
    });
  });
});
