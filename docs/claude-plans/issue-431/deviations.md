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

## 逸脱1b: Step 4 と Step 5 も同じ理由で1コミットにまとめた

- **元の計画内容**: Step 4（改訂ドメイン: `reviseForCustomer` への解決済み単価引数追加）と
  Step 5（改訂アプリ層: `ReviseForCustomerCommand` への価格決定接続）を別コミットにする。
- **実際の実装内容**: 逸脱1 と同様に 1 コミットにまとめた。
- **逸脱の理由**: Step 4 で `reviseForCustomer` に必須引数を追加した時点で、まだ引数を渡していない
  `ReviseForCustomerCommand`（Step 5）と、改訂を利用する周辺テスト（PrismaEstimateRepository・
  GetEstimateDetailQuery）が落ちる。pre-commit が関連テストを実行するため中間 green を保てない。

## 逸脱3: 計画外の追随修正（seed・成功フラッシュ文言）

- **元の計画内容**: Step 6 の対象は「複製モーダル説明文・改訂 UI・関連 E2E」。
- **実際の実装内容**: 加えて以下を修正した。
  - seed（`prisma/seed-estimates.ts`・`prisma/seed-dev-data/estimates.ts`）の
    `reviseForCustomer` 呼び出しに解決済み単価マップ引数を追加（Step 4 のシグネチャ変更の追随）。
  - 複製成功フラッシュ（`redirect-reason-toast.tsx` の `ESTIMATE_DUPLICATED`）の文言を
    「単価はクリアされています。再入力してください」→「複製先条件で再解決されています」に更新。
    関連する actions.ts・duplicateSchema.ts のコメントも同調。
- **逸脱の理由**: いずれも「単価クリア→再解決」への挙動変更の必然的な追随。seed は必須引数追加で
  コンパイル/実行が壊れるため、フラッシュ文言は放置するとユーザに「再入力が必要」と誤誘導するため。

## 逸脱2: 宛先マッピング関数 `toSellingPriceTarget` を `resolveLinePrices.ts` から export

- **元の計画内容**: Step 1 で「既存 `resolveLinePrices` は変更しない」。
- **実際の実装内容**: `resolveLinePrices.ts` の private `toTarget` を `toSellingPriceTarget` に改名して
  export し、複製コマンドから再利用した。
- **逸脱の理由**: 「提出区分→価格決定ターゲット」への消費側マッピング（ADR-20260626-p3w）を
  複製コマンドで再実装すると分岐が二重化する。関数 `resolveLinePrices` 自体の挙動（C1/C3/C4）は
  一切変えておらず、内部ヘルパの可視性を上げて単一ソース化しただけ。計画の意図（C1/C3/C4 の挙動保持）
  は満たしている。
