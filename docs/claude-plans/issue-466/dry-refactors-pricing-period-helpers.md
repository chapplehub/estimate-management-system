# Issue #466: 共通売単価まわりの重複排除リファクタ（#7〜#10・PR #472 追補）— 実装計画

## 概要

PR #472 レビューのクリーンアップ指摘 #7〜#10 を、本PRへの追補として対応する。いずれも
**「private メソッド/共有ヘルパへの抽出」だけで完結し、新しい状態・分岐・複雑性を増やさない純粋な
重複排除**であることを前ターンで確認済み（#5・#6 は逆に複雑性を増やすため見送り）。

- **#7**: `appendPeriodRows` と `syncPeriodRows`（販売単価3層共用の永続化ヘルパ）が daterange 付き
  INSERT 構築を二重実装している。ON CONFLICT 句だけ差し替える行ビルダへ抽出する。
- **#8**: `Edit`/`EndDate`/`Delete` 3コマンドの「`findByProductId` → null なら `NotFoundEntityError`」
  定型が同一反復。共有ヘルパへ抽出する。
- **#9**: 「適用開始日が過去なら違反」ガードが `addPeriod`/`editPeriod` でメッセージ含め完全重複。
  private メソッド `assertStartNotPast` へ抽出する。
- **#10**: 重複チェックが `addPeriod`/`editPeriod`/`endDatePeriod` に3回コピペ。
  private メソッド `assertNoOverlap(period, excludeRow?)` へ抽出する。

## 設計判断

### テスト方針（リファクタゆえ RED を作らない）
- これらは**振る舞いを変えない抽出**であり、公開 API 経由の既存テストが安全網になる
  （#9/#10 は add/edit/endDate の過去開始・重複テスト、#8 は各コマンドの NotFound テスト、
  #7 は3層の Repository 往復・監査・削除テストが既に存在）。
- よって新規テストは追加せず、**各ステップ後に既存テストが緑のままであること**で正しさを担保する
  （TDD スキルの Refactor フェーズ: 「Never refactor while RED」「Run tests after each refactor step」）。
- 抽出で公開シグネチャは変えない。テストが壊れたら抽出が振る舞いを変えた証拠として扱う。

### #7 行ビルダの抽出形
- A. INSERT 本体（テーブル・列・VALUES・daterange）を組む内部関数を1つ用意し、`appendPeriodRows` は
  `ON CONFLICT DO NOTHING`、`syncPeriodRows` は `ON CONFLICT DO UPDATE ... WHERE IS DISTINCT FROM` を
  連結する。
- B. 行ごとの `Prisma.sql` 断片（id/keys/value/period 部）だけ共有し、ON CONFLICT は各関数に残す。
- 推奨: **A**（重複の主因は VALUES 構築部のため、そこを1関数に寄せ ON CONFLICT 句のみ差分にするのが
  重複の純減が最大）。3層共用・コンパイル時定数のみ埋め込む現行の安全前提（識別子の `Prisma.raw`）は維持。
- 注意: #6（多値 VALUES 化）には踏み込まない。行ごとループの構造は保ったまま重複だけ排除する。

### #8 load-or-throw ヘルパの配置
- A. `application/commands` 配下に小さな共有関数（例: `loadCommonSellingPriceOrThrow(repo, productId)`）を置き、
  3コマンドから呼ぶ。
- B. Repository に「無ければ throw」版メソッドを足す。
- 推奨: **A**。理由: 「無ければ NotFound」はアプリ層のユースケース上の関心であり、Repository は
  null を返す問い合わせに徹する（既存規約）。`Register` は null を正常系（insert）に分岐させるため
  このヘルパは使わず、throw 系3コマンド専用とする。

### #9 / #10 抽出
- `CommonSellingPrice` の private メソッドとして抽出する。`assertNoOverlap` は自分自身を除外する
  `excludeRow?` 引数を取り、`addPeriod`（除外なし）/`editPeriod`/`endDatePeriod`（自分を除外）で共用する。
  状態は持たない。エラーメッセージは現行文言を維持する。

### コミット粒度
- CLAUDE.md「意味のあるまとまりでコミット」に従い、**#9+#10（同一ファイル・ドメイン）/ #7 / #8 を
  それぞれ別コミット**にする（レイヤーごとに分離してレビュー可能にする）。

## ステップ

### Step 1: ドメインの重複ガードを private メソッドへ抽出（#9・#10）
- 対象ファイル: `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`
- 作業内容:
  - `assertStartNotPast(start, referenceDate)` を抽出し、`addPeriod`/`editPeriod` の過去開始チェックを置換。
  - `assertNoOverlap(period, excludeRow?)` を抽出し、`addPeriod`（除外なし）・`editPeriod`・`endDatePeriod`
    （`excludeRow` で自分を除外）の重複チェックを置換。
  - メッセージ・公開シグネチャは不変。抽出後 `CommonSellingPrice.test.ts` が緑であることを確認。
- コミットメッセージ:
  `refactor: 共通売単価集約の過去開始・重複チェックをprivateメソッドへ抽出 (#466)`
  - ボディに「addPeriod/editPeriod/endDatePeriod で重複していたガードを assertStartNotPast /
    assertNoOverlap(excludeRow?) に集約。振る舞い不変、既存テストが安全網」と記載。

### Step 2: 永続化の INSERT 構築を行ビルダへ抽出（#7）
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/sellingPricePeriodPersistence.ts`
- 作業内容:
  - `appendPeriodRows`/`syncPeriodRows` が二重に組む「テーブル・列・VALUES（id/keys/value/daterange/
    updated_at）」構築を内部関数へ抽出し、ON CONFLICT 句（DO NOTHING / DO UPDATE … WHERE IS DISTINCT
    FROM）だけ各関数に残す。
  - 行ごとループ構造・`Prisma.raw` 識別子の安全前提は維持（#6 の多値化はしない）。
  - 抽出後、3層の Repository テスト（Common/Customer/DeliveryLocation の往復・監査保持・削除）が緑を確認。
- コミットメッセージ:
  `refactor: 期間行INSERT構築をappend/syncで共有しON CONFLICT句のみ差分化 (#466)`
  - ボディに「daterange付きINSERTの二重実装を行ビルダへ抽出。挿入専用(DO NOTHING)と差分sync
    (DO UPDATE)の違いをON CONFLICT句に局所化。販売単価3層共用・振る舞い不変」と記載。

### Step 3: コマンドの load-or-throw を共有ヘルパへ抽出（#8）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/EditCommonSellingPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/commands/EndDateCommonSellingPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/commands/DeleteCommonSellingPricePeriodCommand.ts`
  - 新規: 共有ヘルパ（例: `application/commands/loadCommonSellingPriceOrThrow.ts`）
- 作業内容:
  - 「`findByProductId` → null なら `NotFoundEntityError(CommonSellingPrice, {productId})`」を共有ヘルパへ
    抽出し、3コマンドから呼ぶ。`Register` は対象外（null を insert 正常系に分岐するため）。
  - 抽出後、3コマンドの NotFound テストを含む各テストが緑を確認。
- コミットメッセージ:
  `refactor: 共通売単価編集系コマンドのload-or-throwを共有ヘルパへ抽出 (#466)`
  - ボディに「Edit/EndDate/Delete で重複する『無ければNotFoundEntityError』をヘルパへ集約。
    Registerはnullを正常系(insert)に分岐するため対象外。アプリ層の関心としてRepositoryはnull返却に徹する」
    と記載。

### Step 4: 計画からの逸脱記録の更新（必要時）
- 対象ファイル: `docs/claude-plans/issue-466/deviations.md`
- 作業内容: 実装中に本計画と異なる対応をした場合のみ追記（CLAUDE.md 規約）。なければスキップ。
- コミットメッセージ: `docs: #466 DRYリファクタの逸脱を記録`
