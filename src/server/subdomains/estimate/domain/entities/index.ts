/**
 * 見積サブドメイン entities バレル。
 *
 * **設計判断**: 集約境界規約により、Estimate 集約の状態変更 API は集約
 * ルート Estimate のみが提供する。子エンティティ (EstimateVariation /
 * EstimateItem / RepairEstimateDetail / AfterRepairEstimateDetail /
 * RevisedEstimateItemDetail) は本バレルから export せず、集約外コードが
 * 直接インスタンス化・操作することを構造的に禁止する。
 *
 * 同 entities ディレクトリ内の相対 import（テストファイル等）は
 * `eslint.config.mjs` の `no-restricted-imports` で許可しているため、
 * 子エンティティ単体テストは引き続き隣接 __tests__ 配下から相対パスで
 * 書ける。
 *
 * リポジトリ実装時（着手順序 #5）に reconstruct() のため子エンティティ
 * を import する経路が必要になる。その際は `entities/internal.ts` のような
 * 別バレルを切る等の方針を別イシューで決定する（計画 設計判断 6）。
 */
export { Estimate } from "./Estimate";
// EstimateFactory は集約外（アプリ層）からの集約生成口。入出力は VO 記述子と
// 集約ルート Estimate のみで、子エンティティ型は露出しないため、本バレルから公開しても
// 集約境界規約を損なわない。
export {
  EstimateFactory,
  type EstimateFactoryInput,
  type EstimateItemDescriptor,
  type EstimateSetGroupDescriptor,
  type EstimateVariationDescriptor,
  type VariationContentDescriptor,
  type RepairDetailDescriptor,
  type AfterRepairDetailDescriptor,
  type CopiedVariationDescriptor,
  type EstimateDuplicateInput,
} from "./EstimateFactory";
// VariationContent は appendVariation / updateVariation の引数型（集約ルートの公開 API）。
// ItemPriceAdjustment は adjustVariationPricing の引数型（#390）。いずれも中身は VO のみで
// 子エンティティ EstimateVariation 自体は露出しないため境界規約を損なわない。
export type { ItemPriceAdjustment, VariationContent } from "./EstimateVariation";
