# Issue #359 実装計画からの逸脱記録

`docs/claude-plans/issue-359/revise-for-customer-c7-ui.md` の計画に対し、実装中に生じた逸脱を記録する。

## 1. ファイルパスの相違（Step 3）

- **元の計画**: リダイレクト理由を `src/server/shared/constants/redirect-reasons.ts`、フラッシュ文言を
  `flash-message-handler.tsx` に追記する。
- **実際の実装**: 実体は `src/shared/constants/redirect-reasons.ts`（`server/` 配下ではない）と
  `src/app/_components/redirect-reason-toast.tsx`。両ファイルに `ESTIMATE_REVISED` とトーストを追記した。
- **理由**: 計画策定時のパス記憶違い。`FLASH_MESSAGES` が `Record<RedirectReason, FlashMessage>` 型で
  網羅を型強制するため、定数追加とメッセージ追加は同一コミットで揃える必要があった（計画どおり1コミット）。

## 2. ステップ順序の入れ替え（Step 2 と Step 3）

- **元の計画**: Step 2（Server Action）→ Step 3（リダイレクト理由）。
- **実際の実装**: Step 3 → Step 2 の順でコミットした。
- **理由**: Server Action が `REDIRECT_REASON.ESTIMATE_REVISED` を参照するため、定数を先に入れないと
  Step 2 のコミットが型エラーで壊れる。各コミットがビルド可能であることを優先した。

## 3. Step 4 を TDD で実装（実装先行 → ユニットTDD）

- **元の計画**: 適格ゲート `isVariationRevisableForCustomer` は「実装先行」。
- **実際の実装**: co-located `variationEditable.test.ts` に RED→GREEN で追加した（純粋述語のため）。
- **理由**: 対象が副作用のない純粋述語で、既存の co-located テストがあり TDD が自然だったため。複製適格との
  差（凍結判定を持たない＝再改訂許可）をテストで明示でき、回帰ガードとして有効。

## 4. 専用シード見積 N9905006 の追加（Step 7）

- **元の計画**: E2E は `estimates-revise-for-customer.e2e.ts`（新設）のみ。シード変更は明記なし。
- **実際の実装**: `prisma/seed-estimates.ts` に C7 専用の見積 `N9905006`（改訂前・hasRevision=false／
  納品先宛 V1＝改訂元適格・得意先宛 V2＝適格外）を追加した。
- **理由**: 改訂は必ず集約を破壊的に変更する。共有見積（N9905001 等）を改訂操作の対象にすると他テスト
  ファイルと状態が結合し脆くなる。各シナリオが専用見積を持つ既存パターン（editable/revised/setGroup）に
  そろえ、初回改訂→ヘッダーロック発火の遷移を観測できる clean な起点を用意した。

## 5. Step 7 ② の検証内容の変更（凍結の UI 観測は不可能）★重要

- **元の計画**: 改訂実行後「改訂元タブに『内容を編集』が出ない＝凍結を UI 観測」する。
- **実際の実装**: その検証は行わず、代わりに UI 観測可能な結果（改訂先 V3 タブの出現・得意先向けバッジ・
  専用フラッシュ「得意先改訂しました」・初回改訂後のヘッダーロック）を検証した。
- **理由**: 現実装では改訂元の凍結を UI から観測できない。
  - `VariationDTO` は per-variation の凍結フラグを持たない（系譜ラベルは S6 送り・DTO コメント参照）。
  - 改訂元の凍結はドメイン `editableVariationOrThrow`（集約横断ガード）で強制され、改訂元の明細自体には
    `revisedDeliveryPrice` が付かない（スナップショットは改訂先の明細に複写される）。
  - 結果として `isVariationEditable(改訂元)` は改訂後も `true`（ACTIVE かつ自分の明細に改訂価格なし）で、
    改訂元タブの「内容を編集」ボタンは残る。クリックして保存するとドメインが例外を投げる二重防御の内側。
  - よって「編集ボタン消失」は起こらず、計画の前提が現実装と矛盾していた。ADR-0012（テストで Prisma 直接
    利用禁止）もありフラグの DB 直接確認もしないため、凍結はユニットテスト済みとして扱い E2E からは外した。
