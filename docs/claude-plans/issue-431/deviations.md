# Issue #431 実装計画からの逸脱記録

## 逸脱1: Step 2 と Step 3 をまとめて1コミットにした

- **元の計画内容**: Step 2（複製ドメイン: `EstimateDuplicationService` への解決済み単価注入）と
  Step 3（複製アプリ層: `DuplicateEstimateCommand` への価格決定接続）を別コミットにする。
- **実際の実装内容**: 2 つを 1 コミット（`feat: 見積複製先の生成に価格決定を接続し...`）にまとめた。
- **逸脱の理由**: Step 2 でドメインの `duplicate()` に必須引数 `resolvedUnitPrices` を追加し
  `Money.zero()` を撤去した時点で、まだ引数を渡していない `DuplicateEstimateCommand` の
  DB 統合テストが必ず落ちる。husky の pre-commit は変更ファイルに関連するテスト群も実行するため、
  Step 2 単独のコミットが green にならない。中間状態を green に保つには両ステップを 1 コミットに
  束ねる必要があった。テスト先行（red→green）の TDD サイクル自体はステップごとに実施している。

## 逸脱2: 宛先マッピング関数 `toSellingPriceTarget` を `resolveLinePrices.ts` から export

- **元の計画内容**: Step 1 で「既存 `resolveLinePrices` は変更しない」。
- **実際の実装内容**: `resolveLinePrices.ts` の private `toTarget` を `toSellingPriceTarget` に改名して
  export し、複製コマンドから再利用した。
- **逸脱の理由**: 「提出区分→価格決定ターゲット」への消費側マッピング（ADR-20260626-p3w）を
  複製コマンドで再実装すると分岐が二重化する。関数 `resolveLinePrices` 自体の挙動（C1/C3/C4）は
  一切変えておらず、内部ヘルパの可視性を上げて単一ソース化しただけ。計画の意図（C1/C3/C4 の挙動保持）
  は満たしている。
