/**
 * 共通売単価 保守画面の読みモデルDTO（#429 第一段階 / プレゼンテーション層先行）。
 *
 * これらは将来 #466（BE基盤）が application/queries/dto に定義する読みモデルの
 * FE先行スタブ。#466完成時にBE側DTOへ差し替える。形は #466 への逆フィードを兼ねる。
 * 用語の正準は CONTEXT.md「価格」節 / use-cases.md。
 */

/** 期間行の派生状態（参照日に対する時点状態。フラグではなく算出値）。 */
export type PeriodState = "current" | "future" | "lapsed";

/** 商品の共通売単価の設定状況（一覧の行ステータス）。 */
export type ProductPriceStatus = "active" | "lapsed" | "unset";

/** UC-1 一覧の1行（商品単位＝集約境界に一致）。 */
export type CommonSellingPriceListItem = {
  productCd: string;
  productName: string;
  /** 現在有効な単価（今日を含む期間の単価）。未設定・失効中は null。 */
  currentPrice: number | null;
  /** 設定状況: active=現在有効 / lapsed=失効中（過去のみ） / unset=未設定（期間なし）。 */
  status: ProductPriceStatus;
};

/** UC-2 期間明細の1行。 */
export type PeriodDetail = {
  periodId: string;
  /** 適用開始日 `YYYY-MM-DD`（期間の下端・含む）。 */
  startDate: string;
  /** 適用終了日 `YYYY-MM-DD`（期間の上端・含まない）。null = 無期限。 */
  endDate: string | null;
  /** 共通売単価（円・0以上）。 */
  price: number;
  /** 参照日に対する派生状態。 */
  state: PeriodState;
};

/**
 * UC-2 商品の期間明細（version付き集約明細）。
 * version は集約ルートの楽観ロック用（ADR-0039）。編集フォームで往復させる。
 */
export type CommonSellingPriceDetail = {
  productCd: string;
  productName: string;
  /** 集約ルートの楽観ロックversion。 */
  version: number;
  /** 適用開始日 昇順の期間行。 */
  periods: PeriodDetail[];
};

/**
 * UC-1 一覧の絞り込み区分。
 * SearchForm に checkbox 型が無いため「未設定のみ」を select で表現する
 * （共有部品を改変しないための決定。詳細は fe-conversion-plan.md #8）。
 */
export type CommonSellingPriceListFilter = "all" | "unset";

/** UC-1 一覧の検索条件（将来の QueryService 入力DTOへ逆フィード）。 */
export type CommonSellingPriceListCriteria = {
  /** 商品コード 部分一致。 */
  code?: string;
  /** 商品名 部分一致。 */
  name?: string;
  /** 設定状況の絞り込み。`unset`=未設定のみ。未指定=すべて。 */
  filter?: CommonSellingPriceListFilter;
};
