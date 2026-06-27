/**
 * 共通売単価 保守画面の インメモリ・モックストア（#429 第一段階 / プレゼンテーション層先行）。
 *
 * BE基盤（#466）が未実装のため、プロトタイプ（`docs/design/common-selling-price-maintenance/
 * 共通売単価 保守画面.dc.html` の `seed()`）のシードを流用した読み取り専用ストア。
 * #466 完成時はこのモジュールごと差し替える（`queries.ts` のシグネチャは維持）。
 *
 * 本ラウンドは読み取りのみ。ミューテータ（登録・編集・削除）は次ラウンドで追加する。
 */

/**
 * 参照日（時点解決の基準日）。プロトタイプの `TODAY` に一致。
 *
 * #466 で未決の「参照日の注入方法」をFE側でも1箇所に閉じ込める。
 * 将来はクロック注入／引数注入へ差し替え可能にするための単一の集約点。
 */
export const REFERENCE_DATE = "2026-06-27";

/** ストア内部の適用期間行（永続層の1レコード相当）。 */
export type MockPeriod = {
  periodId: string;
  /** 適用開始日 `YYYY-MM-DD`（下端・含む）。 */
  startDate: string;
  /** 適用終了日 `YYYY-MM-DD`（上端・含まない）。null=無期限。 */
  endDate: string | null;
  /** 共通売単価（円・0以上）。 */
  price: number;
};

/** ストア内部の商品単位集約（1商品=1集約）。 */
export type MockAggregate = {
  productCd: string;
  productName: string;
  /** 集約ルートの楽観ロックversion（ADR-0039）。 */
  version: number;
  /** 適用期間行（開始日昇順で保持）。 */
  periods: MockPeriod[];
};

/** シード定義の簡易表現（periodId はロード時に決定論的に採番）。 */
type SeedPeriod = {
  startDate: string;
  endDate: string | null;
  price: number;
};
type SeedProduct = {
  productCd: string;
  productName: string;
  periods: SeedPeriod[];
};

/**
 * プロトタイプのシード（PRD001〜015）。
 * カテゴリは UC-1 の列・原価非表示方針（use-cases.md §6）に不要なため読みモデルへ持ち込まない。
 */
const SEED: SeedProduct[] = [
  {
    productCd: "PRD001",
    productName: "オフィスデスク 平机 W1200",
    periods: [
      { startDate: "2024-04-01", endDate: "2025-04-01", price: 28000 },
      { startDate: "2025-04-01", endDate: null, price: 29800 },
    ],
  },
  {
    productCd: "PRD002",
    productName: "事務用チェア 肘付",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 18500 }],
  },
  {
    productCd: "PRD003",
    productName: "ノートPC 14型",
    periods: [
      { startDate: "2025-01-01", endDate: "2026-07-01", price: 98000 },
      { startDate: "2026-07-01", endDate: null, price: 102000 },
    ],
  },
  {
    productCd: "PRD004",
    productName: "デスクトップPC",
    periods: [{ startDate: "2024-10-01", endDate: null, price: 84000 }],
  },
  {
    productCd: "PRD005",
    productName: "モノクロコピー機",
    periods: [{ startDate: "2023-04-01", endDate: "2025-10-01", price: 240000 }],
  },
  {
    productCd: "PRD006",
    productName: "カラー複合機 A3対応",
    periods: [{ startDate: "2025-06-01", endDate: null, price: 320000 }],
  },
  {
    productCd: "PRD007",
    productName: "A4コピー用紙 500枚",
    periods: [],
  },
  {
    productCd: "PRD008",
    productName: "ホワイトボード 1800×900",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 22000 }],
  },
  {
    productCd: "PRD009",
    productName: "スチール書庫 両開き",
    periods: [],
  },
  {
    productCd: "PRD010",
    productName: "LEDデスクライト",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 4800 }],
  },
  {
    productCd: "PRD011",
    productName: "シュレッダー 業務用",
    periods: [{ startDate: "2022-04-01", endDate: "2024-04-01", price: 35000 }],
  },
  {
    productCd: "PRD012",
    productName: "プロジェクター フルHD",
    periods: [
      { startDate: "2025-03-01", endDate: "2026-09-01", price: 72000 },
      { startDate: "2026-09-01", endDate: null, price: 76000 },
    ],
  },
  {
    productCd: "PRD013",
    productName: "会議用テーブル W1800",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 45000 }],
  },
  {
    productCd: "PRD014",
    productName: "トナーカートリッジ 純正",
    periods: [
      { startDate: "2024-04-01", endDate: "2025-04-01", price: 12000 },
      { startDate: "2025-04-01", endDate: null, price: 12800 },
    ],
  },
  {
    productCd: "PRD015",
    productName: "USBメモリ 64GB",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 1280 }],
  },
];

/** シードを集約配列へロードする。periodId は `{商品コード}-p{連番}` で決定論的に採番。 */
function loadSeed(): MockAggregate[] {
  return SEED.map((product) => ({
    productCd: product.productCd,
    productName: product.productName,
    version: 1,
    periods: product.periods.map((period, index) => ({
      periodId: `${product.productCd}-p${index + 1}`,
      startDate: period.startDate,
      endDate: period.endDate,
      price: period.price,
    })),
  }));
}

/** プロセス内に保持する単一ストア（モック）。次ラウンドのミューテータはこれを書き換える。 */
const store: MockAggregate[] = loadSeed();

/** 全集約を商品コード昇順で返す（読み取り専用コピー）。 */
export function getAllAggregates(): MockAggregate[] {
  return [...store].sort((a, b) => a.productCd.localeCompare(b.productCd));
}

/** 商品コードで集約を1件返す。無ければ null。 */
export function getAggregateByProductCd(productCd: string): MockAggregate | null {
  return store.find((aggregate) => aggregate.productCd === productCd) ?? null;
}
