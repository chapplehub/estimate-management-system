import type {
  LineDTO,
  SetGroupDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import type { ExpandedSetGroup } from "../_shared/setComponentExpansion";
import type { VariationLineInput, VariationNodeInput } from "./variationSchema";

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
 * client 専用キー（rowId）を持つ上位集合。JSON 化時は {@link toNodePayload} で schema 項目へ絞る。
 */
export type WorkingLine = {
  /** トップレベル判別子（往復形状 A）。通常明細・構成明細とも "line"。 */
  kind: "line";
  /** client 一意キー（React key・アクティブ行・D&D 用。永続化しない）。 */
  rowId: string;
  productId: string;
  /** 表示用（read-through・ADR-0048）。サーバへは送らない。 */
  productCode: string;
  /** 表示用（read-through・ADR-0048）。サーバへは送らない。 */
  productCategory: string;
  /**
   * 商品の有効フラグ（read-through・ADR-0048）。無効構成のインライン警告を状態導出する
   * （ADR-0052）。サーバへは送らない（保存後の再 read で導出し直す）。
   */
  isActive: boolean;
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

/**
 * 作業コピーのセット群ノード（ADR-0047・往復形状 A）。構成明細（WorkingLine）を入れ子で持つ。
 * 群自身は価格・金額・並び順を持たない（薄い衛星）。表示金額は構成合計の導出（previewAmounts）。
 */
export type WorkingSetGroup = {
  kind: "setGroup";
  /** client 一意キー（React key・D&D 用。既存群は setGroupId、新規は UUID）。 */
  rowId: string;
  productId: string;
  /** 表示用（read-through）。 */
  productCode: string;
  /** セット商品名スナップショット（§8）。 */
  itemName: string;
  /** セット単位スナップショット。 */
  unit: string;
  customerMemo: string;
  internalMemo: string;
  /** 構成明細（順序付き）。空配列は不正（空群禁止・最後の構成削除で群ごと消す）。 */
  components: WorkingLine[];
};

/** 作業コピーのトップレベルノード（通常明細 or セット群）。読み取り DTO と対称。 */
export type WorkingNode = WorkingLine | WorkingSetGroup;

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
    kind: "line",
    rowId,
    productId: product.id,
    productCode: product.code,
    productCategory: product.category,
    // 商品選択モーダルは有効商品のみを返す（selection-actions）ため新規通常行は常に有効。
    isActive: true,
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
    kind: "line",
    rowId: line.itemId,
    productId: line.productId,
    productCode: line.productCode,
    productCategory: line.productCategory,
    isActive: line.isActive,
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
 * 既存セット群 DTO（SetGroupDTO）を作業ノードへ写す。rowId は群の setGroupId（永続・一意）を使う。
 * 構成明細は components を fromLineDTO で写す（順序は read 側で sortOrder 昇順済み）。
 */
export function fromSetGroupDTO(group: SetGroupDTO): WorkingSetGroup {
  return {
    kind: "setGroup",
    rowId: group.setGroupId,
    productId: group.productId,
    productCode: group.productCode,
    itemName: group.itemName,
    unit: group.unit,
    customerMemo: group.customerMemo,
    internalMemo: group.internalMemo,
    components: group.components.map(fromLineDTO),
  };
}

/**
 * 閲覧データの行配列（LineDTO | SetGroupDTO）を作業コピーのノード配列へ写す。
 * 編集開始時に read DTO から作業コピーを初期化する。判別子（kind）でノード種別を振り分ける。
 */
export function fromVariationLines(lines: ReadonlyArray<LineDTO | SetGroupDTO>): WorkingNode[] {
  return lines.map((line) =>
    line.kind === "setGroup" ? fromSetGroupDTO(line) : fromLineDTO(line)
  );
}

/**
 * 自動展開されたセット群（expandSetComponents の結果）を作業ノードへ変換する。
 * 構成明細は単価 0（要入力）・数量＝構成定義・名称/単位/有効性はスナップショット。rowId は
 * 副作用（採番）を避けるため呼び出し側から渡す（群・各構成それぞれに UUID を採る）。
 */
export function createWorkingSetGroup(
  groupRowId: string,
  group: ExpandedSetGroup,
  componentRowId: (componentIndex: number) => string
): WorkingSetGroup {
  return {
    kind: "setGroup",
    rowId: groupRowId,
    productId: group.productId,
    productCode: group.code,
    itemName: group.name,
    unit: group.unit,
    customerMemo: "",
    internalMemo: "",
    components: group.components.map((component, index) => ({
      kind: "line",
      rowId: componentRowId(index),
      productId: component.productId,
      productCode: component.code,
      productCategory: component.category,
      isActive: component.isActive,
      itemName: component.name,
      unit: component.unit,
      quantity: component.quantity,
      unitPrice: 0,
      discountRate: NEW_LINE_DEFAULTS.discountRate,
      itemDiscount: NEW_LINE_DEFAULTS.itemDiscount,
      customerMemo: "",
      internalMemo: "",
    })),
  };
}

/** 作業行を JSON 往復用のペイロード（lineSchema 項目）へ絞る。client 専用列を落とす。 */
function lineFields(line: WorkingLine): VariationLineInput {
  return {
    productId: line.productId,
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

// ========================================
// ノード（通常明細 ＋ セット群）操作（往復形状 A・ADR-0047）
// ========================================

/** rowId がトップレベルノード自身、またはセット群の構成明細であるノードのトップレベル index。 */
function topLevelIndexOf(nodes: ReadonlyArray<WorkingNode>, rowId: string | null): number {
  if (rowId === null) return -1;
  return nodes.findIndex(
    (n) =>
      n.rowId === rowId || (n.kind === "setGroup" && n.components.some((c) => c.rowId === rowId))
  );
}

/**
 * アクティブノードの直下（トップレベル）に newNodes を挿入する。アクティブが構成明細／セット群の
 * ときは、それを含むセット群の直後＝トップレベルへ挿入する（構成の連続配置・非交錯を保つ）。
 * アクティブが null／不明なら末尾へ。元配列は破壊しない。
 */
export function insertNodesBelow(
  nodes: WorkingNode[],
  activeRowId: string | null,
  newNodes: WorkingNode[]
): WorkingNode[] {
  const index = topLevelIndexOf(nodes, activeRowId);
  if (index < 0) {
    return [...nodes, ...newNodes];
  }
  return [...nodes.slice(0, index + 1), ...newNodes, ...nodes.slice(index + 1)];
}

/**
 * rowId のノードを取り除く。トップレベル（通常明細・セット群）ならそのまま除去（セット群は構成を
 * 入れ子で持つため自動カスケード）。構成明細なら所属群から除去し、**最後の構成が消えたら群ごと
 * 自動削除**する（空群禁止の第一防御）。
 */
export function removeNode(nodes: WorkingNode[], rowId: string): WorkingNode[] {
  if (nodes.some((n) => n.rowId === rowId)) {
    return nodes.filter((n) => n.rowId !== rowId);
  }
  return nodes.flatMap((n) => {
    if (n.kind !== "setGroup" || !n.components.some((c) => c.rowId === rowId)) {
      return [n];
    }
    const components = n.components.filter((c) => c.rowId !== rowId);
    // 最後の構成を削除したら群ごと自動削除する（表示位置・金額を導出できなくなるため）。
    return components.length === 0 ? [] : [{ ...n, components }];
  });
}

/**
 * 通常明細・構成明細を問わず、rowId の作業行へ patch を適用する（インライン編集）。
 * 構成明細はそれを含むセット群の components 内で更新する。
 */
export function changeNodeLine(
  nodes: WorkingNode[],
  rowId: string,
  patch: Partial<WorkingLine>
): WorkingNode[] {
  return nodes.map((n) => {
    if (n.kind === "line") {
      return n.rowId === rowId ? { ...n, ...patch } : n;
    }
    if (!n.components.some((c) => c.rowId === rowId)) {
      return n;
    }
    return {
      ...n,
      components: n.components.map((c) => (c.rowId === rowId ? { ...c, ...patch } : c)),
    };
  });
}

/** トップレベルノードを from→to へ移動する（群＝トップレベルの D&D。dnd-kit arrayMove と同型）。 */
export function reorderNodes(nodes: WorkingNode[], from: number, to: number): WorkingNode[] {
  const next = [...nodes];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** 指定セット群の構成明細を from→to へ移動する（構成＝群内のみの D&D）。 */
export function reorderComponents(
  nodes: WorkingNode[],
  groupRowId: string,
  from: number,
  to: number
): WorkingNode[] {
  return nodes.map((n) => {
    if (n.kind !== "setGroup" || n.rowId !== groupRowId) {
      return n;
    }
    const components = [...n.components];
    const [moved] = components.splice(from, 1);
    components.splice(to, 0, moved);
    return { ...n, components };
  });
}

/**
 * 全ノードから価格付き末端行（通常明細＋全構成明細）を出現順でフラット化する。
 * セット群は価格を持たない薄い衛星のため、金額プレビュー（小計・合計）はこのフラット列で計算する。
 */
export function flattenPricedLines(nodes: ReadonlyArray<WorkingNode>): WorkingLine[] {
  return nodes.flatMap((n) => (n.kind === "setGroup" ? n.components : [n]));
}

/** 作業ノードを JSON 往復用のペイロード（nodeSchema 項目）へ絞る。client 専用列を落とす。 */
export function toNodePayload(nodes: ReadonlyArray<WorkingNode>): VariationNodeInput[] {
  return nodes.map((n) =>
    n.kind === "setGroup"
      ? {
          kind: "setGroup" as const,
          productId: n.productId,
          itemName: n.itemName,
          unit: n.unit,
          customerMemo: n.customerMemo,
          internalMemo: n.internalMemo,
          components: n.components.map(lineFields),
        }
      : { kind: "line" as const, ...lineFields(n) }
  );
}
