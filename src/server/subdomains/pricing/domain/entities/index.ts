/**
 * pricing サブドメイン entities バレル。
 *
 * **設計判断**: 集約境界規約（ADR-0027）により、共通販売単価集約の状態変更 API は
 * 集約ルート CommonSellingPrice のみが提供する。子エンティティ CommonSellingPricePeriod
 * は本バレルから export せず、集約外コードが直接インスタンス化・操作することを禁止する
 * （`eslint.config.mjs` の `no-restricted-imports` で構造的に担保）。
 *
 * Mapper からの再構成は、子エンティティ型ではなく VO 記述子
 * （{@link CommonSellingPricePeriodSnapshot}）を `reconstruct` に渡す経路で行う。
 * 記述子は VO のみで構成され子エンティティ型を露出しないため、本バレルから公開してよい。
 */
export { CommonSellingPrice } from "./CommonSellingPrice";
export type { CommonSellingPricePeriodSnapshot } from "./CommonSellingPrice";
export { CustomerSellingPrice } from "./CustomerSellingPrice";
export type { CustomerSellingPricePeriodSnapshot } from "./CustomerSellingPrice";
