// NOTE: 当初計画では `import "server-only"` でクライアント混入を防ぐ予定だったが、
// 本リポジトリは `server-only` パッケージを未導入（既存クエリ層も不使用）。
// ビルド破壊を避けるため省略する。サーバ専用性は Server Component 経由の利用で担保。
import type {
  CommonSellingPriceDetail,
  CommonSellingPriceListCriteria,
  CommonSellingPriceListItem,
  PeriodDetail,
  PeriodState,
  ProductPriceStatus,
} from "./types";
import {
  getAggregateByProductCd,
  getAllAggregates,
  REFERENCE_DATE,
  type MockAggregate,
  type MockPeriod,
} from "./mock-store";

/**
 * 共通売単価 保守画面の読みクエリ（#429 第一段階 / モック境界）。
 *
 * 将来の QueryService と同形の async 関数として定義する。
 * #466 完成時は中身（モックストア参照→Factory経由 QueryService）だけ差し替え、
 * シグネチャ（引数・戻り値DTO）は維持する。
 *
 * 射影ロジック（classify / prodStatus）はプロトタイプ
 * （`共通売単価 保守画面.dc.html`）の同名関数に一致させている。
 */

/**
 * 期間行の参照日に対する時点状態を判定する。
 * ISO日付（`YYYY-MM-DD`）は辞書順比較がそのまま日付順比較になるため文字列比較で足りる。
 */
function classify(period: MockPeriod): PeriodState {
  if (REFERENCE_DATE < period.startDate) return "future";
  if (period.endDate != null && REFERENCE_DATE >= period.endDate) return "lapsed";
  return "current";
}

/** 集約から現在有効な期間行（参照日を含む期間。高々1件）を返す。 */
function currentPeriod(aggregate: MockAggregate): MockPeriod | null {
  return aggregate.periods.find((period) => classify(period) === "current") ?? null;
}

/** 集約の設定状況を判定する（期間なし=未設定 / 現在有効あり=active / それ以外=失効中）。 */
function productStatus(aggregate: MockAggregate): ProductPriceStatus {
  if (aggregate.periods.length === 0) return "unset";
  return currentPeriod(aggregate) != null ? "active" : "lapsed";
}

/** 集約を一覧アイテムDTOへ射影する。 */
function toListItem(aggregate: MockAggregate): CommonSellingPriceListItem {
  const current = currentPeriod(aggregate);
  return {
    productCd: aggregate.productCd,
    productName: aggregate.productName,
    currentPrice: current?.price ?? null,
    status: productStatus(aggregate),
  };
}

/** 期間行を明細DTOへ射影する。 */
function toPeriodDetail(period: MockPeriod): PeriodDetail {
  return {
    periodId: period.periodId,
    startDate: period.startDate,
    endDate: period.endDate,
    price: period.price,
    state: classify(period),
  };
}

/**
 * UC-1 商品横断の一覧を取得する。
 * 商品コード・商品名の部分一致、設定状況（未設定のみ）で絞り込む。
 */
export async function fetchCommonSellingPriceList(
  criteria: CommonSellingPriceListCriteria = {}
): Promise<CommonSellingPriceListItem[]> {
  const code = criteria.code?.trim().toLowerCase();
  const name = criteria.name?.trim().toLowerCase();

  return getAllAggregates()
    .filter((aggregate) => {
      if (code && !aggregate.productCd.toLowerCase().includes(code)) return false;
      if (name && !aggregate.productName.toLowerCase().includes(name)) return false;
      if (criteria.filter === "unset" && aggregate.periods.length !== 0) return false;
      return true;
    })
    .map(toListItem);
}

/**
 * UC-2 商品の適用期間明細を取得する。
 * 期間行は適用開始日昇順。存在しない商品コードなら null。
 */
export async function fetchCommonSellingPriceDetail(
  productCd: string
): Promise<CommonSellingPriceDetail | null> {
  const aggregate = getAggregateByProductCd(productCd);
  if (aggregate == null) return null;

  const periods = [...aggregate.periods]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(toPeriodDetail);

  return {
    productCd: aggregate.productCd,
    productName: aggregate.productName,
    version: aggregate.version,
    periods,
  };
}
