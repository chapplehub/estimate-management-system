/**
 * 見積詳細画面（S2 閲覧）の表示用データ転送オブジェクト（CQRS read model）。
 *
 * 集約再構築を経ず Prisma を直読みして組み立てる（計画 Q1）。金額は永続化スキーマの
 * Decimal(12,2)（主単位＝円）をそのまま数値で載せる（ADR-0033: 保存済み集計を信頼）。
 */
export type EstimateDetailDTO = {
  estimateId: string;
  estimateNumber: string;
  /** 見積区分（"NEW" | "REPAIR" | "AFTER_REPAIR"）。 */
  estimateType: string;
  estimateDate: Date;
  deadline: Date;
  /** 楽観ロックトークン。S3 編集で DTO を変えずに往復させる（ADR-0039・Q10 前倒し）。 */
  version: number;

  // ③ 基本情報（ADR-0013: リレーション先の名前・コードを含める）
  customerId: string;
  customerCode: string;
  customerName: string;
  deliveryLocationId: string;
  deliveryLocationCode: string;
  deliveryLocationName: string;
  departmentId: string;
  /** 部署はコードを持たず名称のみ（schema 上 code 列なし）。 */
  departmentName: string;
  creatorId: string;
  /** 作成者の社員コード（Employee.employeeCd）。 */
  creatorCode: string;
  creatorName: string;

  /** 消費税率（見積時点スナップショット）。S3 では read-only 表示のみ（自由入力不可）。 */
  taxRate: number;
  /** 税端数区分（"ROUND_DOWN" | "ROUND_UP" | "ROUND"）。S3 で編集可・閲覧モードにも表示。 */
  taxRoundingType: string;
  /**
   * 改訂（C7 得意先改訂）がいずれかのバリエーションに存在するか（§7.2 / ADR-0044）。
   * S3 でロック項目（見積年月日・得意先・納品先・税端数）の disabled 出し分けを駆動する。
   * 最終強制はドメイン（assertHeaderMutable）が担う二重防御（ADR-0049）。
   */
  hasRevision: boolean;

  // ③ 修理情報（排他サブタイプ。REPAIR / AFTER_REPAIR のときだけ非 null・Q10）
  /** REPAIR のとき非 null。 */
  repairDetail: RepairDetailDTO | null;
  /** AFTER_REPAIR のとき非 null。 */
  afterRepairDetail: AfterRepairDetailDTO | null;

  /** バリエーション（変種）。variationNumber 昇順。 */
  variations: VariationDTO[];
};

/** 修理情報（事前修理・REPAIR）。対象機器は read-through join で解決。 */
export type RepairDetailDTO = {
  targetProductId: string;
  targetProductCode: string;
  targetProductName: string;
  faultDescription: string;
  scheduledRepairDate: Date;
};

/** 事後修理情報（AFTER_REPAIR）。対象機器は read-through join で解決。 */
export type AfterRepairDetailDTO = {
  targetProductId: string;
  targetProductCode: string;
  targetProductName: string;
  faultDescription: string;
  actualRepairDate: Date;
  emergencyReason: string;
  /** 10万円超警告の確認済フラグ。 */
  afterServiceWarningAcknowledged: boolean;
};

/**
 * バリエーション単位の表示 DTO。集計 5 種は永続化済みの保存値（ADR-0033）。
 * 系譜ラベル（改訂元/複製元）は S6 へ先送り（Q10）のため本 DTO には含めない。
 */
export type VariationDTO = {
  variationId: string;
  variationNumber: number;
  /** バリエーション状態（"ACTIVE" | "INACTIVE"）。全無効警告は presentation 側で導出（Q7）。 */
  status: string;
  /** 提出区分（"CUSTOMER" | "DELIVERY_LOCATION"・ADR-0045 不変属性）。 */
  submissionType: string;
  overallDiscount: number;
  customerMemo: string;
  internalMemo: string;

  // ⑨ 金額サマリー（永続集計・ADR-0033）
  subtotal: number;
  discountSubtotal: number;
  finalSubtotal: number;
  taxAmount: number;
  finalTotal: number;

  /**
   * 明細行（通常明細とセット群の混在）。top-level の表示順（sortOrder 昇順）。
   * セット群は構成明細を `components` に内包し、構成明細は top-level には現れない
   * （連続配置・非交錯の不変条件・ADR-0047）。判別は `kind` で行う。
   */
  lines: (LineDTO | SetGroupDTO)[];
};

/**
 * 明細行 DTO（通常明細・構成明細で共用）。
 *
 * 金額は永続化済みの保存値。`productCode`/`productCategory` は現在マスタ join による
 * read-through（ADR-0048。出所＝マスタ/将来スナップショットは query service の実装詳細）。
 */
export type LineDTO = {
  kind: "line";
  itemId: string;
  productId: string;
  /** 商品コード（read-through・ADR-0048）。 */
  productCode: string;
  /** 商品区分（read-through・ADR-0048。enum 値 "INDIVIDUAL" | "CONSUMABLE" | "SET"）。 */
  productCategory: string;
  /**
   * 商品の有効フラグ（read-through・ADR-0048）。無効構成商品のインライン警告を
   * UI が状態導出するために用いる（ADR-0052）。
   */
  isActive: boolean;
  /** 商品名スナップショット（作成時凍結・§8）。 */
  itemName: string;
  sortOrder: number;
  quantity: number;
  /** 単位スナップショット（作成時凍結）。 */
  unit: string;
  unitPrice: number;
  discountRate: number;
  itemDiscount: number;
  baseAmount: number;
  finalAmount: number;
  customerMemo: string;
  internalMemo: string;
  /** 得意先改訂で生まれた明細のみ持つ納品先価格スナップショット（§8.4）。なければ null。 */
  revisedDeliveryPrice: number | null;
};

/**
 * セット群 DTO（ADR-0047 / Shape ③-a）。
 *
 * 群自身は価格・金額・並び順を持たない薄い衛星。`amount`（＝構成明細 finalAmount 合計）と
 * `sortOrder`（＝構成明細 sortOrder の最小値＝表示位置）は read 側で導出して 1 回確定する
 * （write 側 deriveSetGroup と同じ SetGroupDerivationPolicy を再利用・Q2）。
 */
export type SetGroupDTO = {
  kind: "setGroup";
  setGroupId: string;
  productId: string;
  /** セット商品コード（read-through・ADR-0048）。 */
  productCode: string;
  /** セット商品区分（read-through・ADR-0048。常に "SET"）。 */
  productCategory: string;
  /** セット商品名スナップショット。 */
  itemName: string;
  unit: string;
  customerMemo: string;
  internalMemo: string;
  /** 導出（ADR-0047）: 構成明細 finalAmount の合計。 */
  amount: number;
  /** 導出（ADR-0047）: 構成明細 sortOrder の最小値（＝群の表示位置）。 */
  sortOrder: number;
  /** 構成明細（sortOrder 昇順）。 */
  components: LineDTO[];
};
