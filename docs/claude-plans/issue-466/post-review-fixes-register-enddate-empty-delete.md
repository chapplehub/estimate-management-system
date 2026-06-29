# Issue #466: PRレビュー指摘の修正（登録楽観ロック・適用終了の短縮ガード・空集約delete検証）— 実装計画

## 概要

PR #472 のコードレビューで挙がった10件を評価した結果、対応すると合意した3件を修正する。

- **#1（要修正・堅牢性）**: `RegisterCommonSellingPricePeriodCommand` が既存集約への追加で
  `update(existing, input.expectedVersion ?? 0)` を呼ぶ。`version` は1始まりのため `?? 0` は実 version と
  永久に一致せず、`expectedVersion` 省略時に必ず `ConflictError` になる。silent conflict を loud failure へ。
- **#2（機能バグ）**: `CommonSellingPrice.endDatePeriod` が `endDate > referenceDate` しか見ておらず、
  既存 end と比較しないため期間を「短縮」ではなく「延長」できる。半開区間 `[開始, 終了)` の短縮のみ許す
  ガードを追加する。
- **#4（テストギャップ）**: 最後の将来行を削除すると `syncPeriodRows` が `rows=[]` で
  `DELETE ... ANY('{}'::uuid[])` を走らせる。この delete-to-empty 経路が未テストのため挙動を確定させる。

評価で「却下」した #5（提案された `insert()` 修正は楽観ロックの version bump を見落とした誤り）、および
軽微な DRY/効率（#3, #6〜#10）は本PRでは対象外（必要なら別Issue）。

レビュー評価の全文は会話ログ参照。本計画は #2 → #1 → #4 の順で TDD（テスト→実装の縦スライス）で進める。

## 設計判断

### #1 既存集約への追加で expectedVersion が未指定のときの扱い
- A. 未指定なら明示的に throw（`?? 0` を撤廃。既存集約あり かつ `expectedVersion === undefined` で
  即エラー）。入力型は optional のまま（insert 経路では version 不要）。
- B. 入力型を新規登録/既存追加で discriminated union に分け、型レベルで必須化。
- **採用: A**。理由: silent conflict（「他のユーザーによって更新…」の誤表示）を loud failure に変えるのが
  最小修正。deviations.md の「UIは『登録』一択で未設定/既存を区別せず呼ぶ」方針とコマンドAPIの形を
  保てる（編集画面は version を持つため通常は指定される。未指定は呼び出し側の契約違反として早期に弾く）。
- エラー型: ドメイン不変条件ではなく入力契約の不備のため、アプリ層で `ValidationError`
  （`@server/shared/errors/...`）を投げる。実装時に既存のエラー語彙・throw 規約（ADR-0038）に合わせて確定。

### #2 適用終了のガード仕様（短縮のみ・厳密に手前）
- 採用: 短縮のみ許可。既存 end が**有界**なら新 `endDate < row.period.end` を必須にする
  （`endDate === 既存end`〔no-op〕や延長は違反）。既存 end が **null（無期限）** なら任意の未来日が
  正当な短縮として許可する。既存の `endDate > referenceDate`（今日より後）ガードは維持する。
- 理由: 操作の意味は「適用終了（打ち切り）」であり延長ではない。延長は過去不変は破らない（未来方向のみ
  影響）が、本来失効すべき単価が生き残り未来見積の単価判定を誤らせる。判定は集約の半開区間意味論で揃える。

### #4 空集約 delete 経路の対応範囲
- 採用: delete-to-empty のテストを追加して挙動を確定する。正常動作するなら回帰テストとして残す。万一
  未翻訳のドライバエラー等が出たら同ステップ内で実装修正まで踏み込む。
- 理由: `ANY('{}'::uuid[])` は PostgreSQL 的に正当でPrismaの空配列バインドも通常動作する想定だが、
  到達可能（最後の将来行削除）かつ未検証。テストで事実を固定する。

## ステップ

### Step 1: 適用終了の短縮ガードを追加（#2・機能バグ）
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/__tests__/CommonSellingPrice.test.ts`（テスト先行）
  - `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`
- 作業内容:
  - RED: `endDatePeriod` で「有界の現在有効行に既存 end 以上の endDate を渡すと
    `BusinessRuleViolationError`」のテストを追加。境界（`endDate === 既存end` も違反、
    `endDate < 既存end` は成功、無期限行は任意未来日で成功）を縦スライスで詰める。
  - GREEN: `endDatePeriod` に「`row.period.end !== null` なら `endDate < row.period.end` を必須」とする
    ガードを追加。既存の `endDate > referenceDate` ガード・重複チェック・状態（現在有効行限定）判定は維持。
  - エラーメッセージは既存スタイル（`${ENTITY_NAME}の適用終了日は…`）に合わせる。
- コミットメッセージ:
  `fix: 共通売単価の適用終了が期間を延長できる不具合を修正（短縮のみ許可・既存endガード追加） (#466)`
  - ボディに「半開区間の短縮のみ許可。無期限行は任意未来日、有界行は厳密に手前。延長は本来失効すべき
    単価を生かし未来見積の単価判定を誤らせるため違反」と設計判断を記載。

### Step 2: 登録コマンドの楽観ロック fallback を是正（#1・堅牢性）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/__tests__/RegisterCommonSellingPricePeriodCommand.test.ts`
  - `src/server/subdomains/pricing/application/commands/RegisterCommonSellingPricePeriodCommand.ts`
- 作業内容:
  - RED: 「既存集約への追加で `expectedVersion` 未指定なら（ConflictError ではなく）入力契約違反として
    `ValidationError` が投げられる」テストを追加。既存の「正しい version で update 成功」「古い version で
    ConflictError」テストは維持されることを確認。
  - GREEN: `?? 0` を撤廃。`existing !== null` のとき `input.expectedVersion === undefined` なら
    `ValidationError` を throw、指定時は `update(existing, input.expectedVersion)`。insert 経路は不変。
  - エラー型・メッセージは既存のアプリ層エラー語彙（ADR-0038 の throw 規約）に合わせて確定。
- コミットメッセージ:
  `fix: 共通売単価登録の楽観ロックfallbackを是正（expectedVersion未指定をConflictErrorからValidationErrorへ） (#466)`
  - ボディに「`?? 0` は1始まりversionと永久不一致で必ずConflict。silent conflictをloud failureへ。
    既存集約追加ではexpectedVersion必須、insert経路は不要のため入力型はoptional維持」と記載。

### Step 3: 空集約 delete 経路のテスト追加（#4・テストギャップ）
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/prisma/__tests__/PrismaCommonSellingPriceRepository.test.ts`
  - （必要時のみ）`src/server/subdomains/pricing/infrastructure/prisma/sellingPricePeriodPersistence.ts`
- 作業内容:
  - RED→確認: 「将来行1件のみの集約から最後の行を削除して `update` すると、DB の期間行が0件になり例外なく
    完了する」テストを追加（`deletePeriod` 経由で空集約 → `syncPeriodRows` が `rows=[]` で DELETE）。
  - 正常動作するなら回帰テストとして残す。未翻訳のドライバエラー等が出た場合のみ、空配列バインド
    （`ANY(空)`）を安全に扱うよう実装を修正してテストを通す。
- コミットメッセージ:
  `test: 共通売単価の最後の期間削除（空集約delete）経路を検証 (#466)`
  - 実装修正を伴った場合は `fix:` に変更し、ボディに修正内容と理由を記載。

### Step 4: 計画からの逸脱記録の更新（必要時）
- 対象ファイル: `docs/claude-plans/issue-466/deviations.md`
- 作業内容: 実装中に本計画と異なる対応をした場合のみ追記（CLAUDE.md 規約）。なければスキップ。
- コミットメッセージ: `docs: #466 レビュー対応の逸脱を記録`
