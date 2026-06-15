import type { LineDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import type { VariationLineInput } from "./variationSchema";

/**
 * バリ内容編集の作業コピー（client state）操作（ADR-0050: 配列順 = 真実）。
 *
 * 明細はモーダル選択・インライン編集・D&D で本質的に client state が真実になる。本モジュールは
 * その配列を組み替える純関数群を提供する（追加・削除・並替を「配列を作り直すだけ」に統一）。
 * 行の一意キー（rowId）生成は副作用なので呼び出し側に委ね、ここは決定論を保つ。
 */

/** 商品スナップショット（選択モーダル行／findById 由来）。 */
export type ProductSnapshot = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
};

/**
 * 作業コピー1行。`lineSchema` の項目に加え、表示用（productCode/productCategory）と
 * client 専用キー（rowId）を持つ上位集合。JSON 化時は {@link toLinePayload} で schema 項目へ絞る。
 */
export type WorkingLine = {
  /** client 一意キー（React key・アクティブ行・D&D 用。永続化しない）。 */
  rowId: string;
  productId: string;
  /** 表示用（read-through・ADR-0048）。サーバへは送らない。 */
  productCode: string;
  /** 表示用（read-through・ADR-0048）。サーバへは送らない。 */
  productCategory: string;
  /** 商品名スナップショット（§8・編集不可）。 */
  itemName: string;
  /** 単位スナップショット（§8・編集不可）。 */
  unit: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  itemDiscount: number;
  customerMemo: string;
  internalMemo: string;
};

/** 新規行の既定値（数量1・単価0・掛率1.0・値引0）。 */
const NEW_LINE_DEFAULTS = {
  quantity: 1,
  unitPrice: 0,
  discountRate: 1.0,
  itemDiscount: 0,
} as const;

/** 上書き可能な数値項目（周辺サジェストは数量＝relation の quantity を渡す）。 */
type LineNumericOverrides = Partial<
  Pick<WorkingLine, "quantity" | "unitPrice" | "discountRate" | "itemDiscount">
>;

/**
 * 商品スナップショットから新規作業行を作る。商品名・単位・コード・区分を固定値として写し、
 * 数量・単価・掛率・値引は新規行既定（overrides で上書き可）。
 */
export function createWorkingLine(
  rowId: string,
  product: ProductSnapshot,
  overrides: LineNumericOverrides = {}
): WorkingLine {
  return {
    rowId,
    productId: product.id,
    productCode: product.code,
    productCategory: product.category,
    itemName: product.name,
    unit: product.unit,
    ...NEW_LINE_DEFAULTS,
    ...overrides,
    customerMemo: "",
    internalMemo: "",
  };
}

/**
 * 既存明細 DTO（LineDTO）を作業行へ写す。編集開始時に閲覧データから作業コピーを初期化する。
 * rowId は明細の itemId（永続・一意）をそのまま使う（新規行のみ呼び出し側で UUID を採番）。
 * S4 編集対象は非改訂バリのため revisedDeliveryPrice は常に null で作業コピーには持ち込まない。
 */
export function fromLineDTO(line: LineDTO): WorkingLine {
  return {
    rowId: line.itemId,
    productId: line.productId,
    productCode: line.productCode,
    productCategory: line.productCategory,
    itemName: line.itemName,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountRate: line.discountRate,
    itemDiscount: line.itemDiscount,
    customerMemo: line.customerMemo,
    internalMemo: line.internalMemo,
  };
}

/**
 * アクティブ行（activeRowId）の直下に newLines を挿入する。アクティブ行が null または
 * 見つからない場合は末尾へ追加する（行 UI 仕様）。元配列は破壊せず新しい配列を返す。
 */
export function insertBelow(
  lines: WorkingLine[],
  activeRowId: string | null,
  newLines: WorkingLine[]
): WorkingLine[] {
  const index = activeRowId === null ? -1 : lines.findIndex((l) => l.rowId === activeRowId);
  if (index < 0) {
    return [...lines, ...newLines];
  }
  return [...lines.slice(0, index + 1), ...newLines, ...lines.slice(index + 1)];
}

/** rowId に一致する行を取り除く（確認なし・§5）。一致しなければそのまま。 */
export function removeLine(lines: WorkingLine[], rowId: string): WorkingLine[] {
  return lines.filter((l) => l.rowId !== rowId);
}

/** index ベースで from を to へ移動する（D&D 並べ替え。dnd-kit の arrayMove と同型）。 */
export function reorderLines(lines: WorkingLine[], from: number, to: number): WorkingLine[] {
  const next = [...lines];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** 作業行を JSON 往復用のペイロード（lineSchema 項目）へ絞る。client 専用列を落とす。 */
export function toLinePayload(lines: WorkingLine[]): VariationLineInput[] {
  return lines.map((line) => ({
    productId: line.productId,
    itemName: line.itemName,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountRate: line.discountRate,
    itemDiscount: line.itemDiscount,
    customerMemo: line.customerMemo,
    internalMemo: line.internalMemo,
  }));
}
