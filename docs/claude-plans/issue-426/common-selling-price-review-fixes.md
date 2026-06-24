# Issue #426: 共通販売単価集約 PR #449 レビュー指摘の対応 — 実装計画

## 概要

PR #449 のコードレビュー指摘のうち、本 PR スコープで対応する 3 件（#1 エラー契約・#3 Money 精度・#4 `updated_at` 保持）を修正する。あわせてレビュー議論で派生した設計改善「価格 VO は常に `Money` を引数に取る（`SellingUnitPrice.fromMajorUnits` 削除）」を反映する。

対応対象と棄却:
- **#1（🟠 エラー契約の非対称）**: 対応（親 PK 衝突の P2002 のみ翻訳）。
- **#2（🟠 version 読み出し経路）**: 本 PR スコープ外。アプリ層 issue #429 へ引き継ぎ済み（コード変更なし）。
- **#3（🟡 Money 読み出しの精度）**: 対応（読み出しのみ float 経由を排除）。
- **#4（🟡 `updated_at` リセット）**: 対応（`update` を append-only 同期へ簡約）。
- **#5/#6（🟢 バルク挿入・SQL 重複）**: 見送り（別 issue 候補）。

## 設計判断

### #4 期間行の同期戦略 — append-only 同期へ簡約
- A. 現状維持（全削除 → identity 再利用で全挿入）
- B. 3 方向 id 差分（挿入＋削除＋未変更据え置き）
- C. append-only 同期（version チェック → `INSERT ... ON CONFLICT (id) DO NOTHING`、DELETE 分岐なし）
- **採用: C**
- 理由: ドメインの変更操作は `addPeriod`（追加）のみで、子 `CommonSellingPricePeriod` はセッターを持たず **id 単位で内容不変**。`reconstruct` が DB 全行を集約に載せ `addPeriod` は足すだけなので、集約は常に DB の id を包含し「DB にあって集約に無い id（=削除）」は発生しえない。よって DELETE 分岐・in-place UPDATE は到達不能な死にコード。append-only なら既存行に一切触れないため `updated_at` は新規行以外まったく動かず #4 を根治する。DELETE 分岐は #429 が `removePeriod` を実装するときにテスト付きで追加する。

### #4 EXCLUDE 制約の DEFERRABLE 化
- A. `DEFERRABLE INITIALLY DEFERRED` 化して将来の in-place 改定に備える
- B. 現状維持（非 deferrable）
- **採用: B**
- 理由: append-only 同期では既存行を触らず追加行も最終集合に対し非重複（ドメイン保証）ゆえ、自トランザクション内で EXCLUDE の瞬間衝突は起きない。deferrable 化は #429 が in-place 改定を入れるとき判断する。migration 変更なし。

### #1 エラー契約 — P2002 のみ翻訳、EXCLUDE 翻訳は見送り
- 親 PK 衝突（同一商品の二重 insert）→ P2002 を `ConflictError` へ翻訳（既存 `translateInsertConflict` パターン踏襲）。**対応する。**
- 期間行の EXCLUDE 違反（23P01）→ `ConflictError` 翻訳は**見送る**。
- 理由: `insert` は親 PK、`update` は version 条件付き updateMany が同一商品の期間並行書き込みを直列化するため、`writePeriods` の EXCLUDE は**公開 API 経由では到達不能**（既存テスト#5 はリポジトリを通さず直 INSERT で発火させている）。翻訳を足してもトリガーするテストが書けず死にコードになる（通貨ガード省略と同じ YAGNI 判断軸）。EXCLUDE は SQL 直叩き・論理バグに対する DB 側の最後の砦として残す。

### #3 Money 読み出しの精度 — `Money.fromDecimalString` 新設・読み出しのみ修正
- 置き場所: A. shared `Money.fromDecimalString(value, currency)` 新設 / B. Mapper 内 private ヘルパ
- **採用: A**
- 理由: `Money` は既に永続化境界ファクトリ `fromMinorUnits` を持ち前例がある。スケールを知るのは `Money` 自身。#447（原価の Money 化）も DECIMAL 列を読むため共有ファクトリが再発防止になる（DRY）。
- 範囲: **読み出しのみ**。`Number("...")` は上限帯（約 100 億円弱の単価）で `fromMajorUnits` の厳密ガード（`|minor-round| > 1e-6`）に引っかかり `InvalidArgumentError` で再構成失敗する（実測。データ破壊はなく loud fail）。書き込みの `money.majorUnits.toFixed(scale)` は整数 minorUnits 由来で `toFixed` が正しく丸めるため上限でも厳密 → **現状維持**（触ると過剰）。

### 価格 VO は常に `Money` を引数に取る — `SellingUnitPrice.fromMajorUnits` 削除
- `SellingUnitPrice.fromMajorUnits(number)` は `Money` の number ドアを VO 層で二重に開けるだけ。#3 修正後は production の唯一の呼び出し元（Mapper）が `fromMoney(Money.fromDecimalString(...))` に変わり、production 呼び出しはゼロになる。
- **採用: 生成口を `fromMoney(Money)` のみにする。** number↔金額の変換と精度ガードは `Money` に集約し、`SellingUnitPrice` は受け取った `Money` に「非負」不変条件のみを課す。
- `get majorUnits(): number`（読み出し getter）は表示・シリアライズ用で生成とは別問題のため今回は残す。

### #447 へ引き継ぐ発見（CostPrice）
- `CostPrice` は `ValueObject<number>` で **Money ですらなく**、`ProductMapper` が `new CostPrice(Number(prismaProduct.costPrice))` と同一の `Number(Decimal)` 罠を踏み、非負・小数2桁を自前 float 検証している。
- 本 PR では触らず（#426 肥大化回避）、横断原則「価格/金額 VO は常に `Money` を引数に取る」と CostPrice の具体的発見を `learning/` に記録して #447 が拾えるようにする。

## ステップ

### Step 1: Money.fromDecimalString を新設（#3 の土台）
- 対象ファイル: `src/server/shared/domain/values/Money.ts`, `src/server/shared/domain/values/__tests__/Money.test.ts`
- 作業内容:
  - 先にテスト（赤）: `"1234.56"`→123456 銭、`"30000"`/`"30000.00"`、上限 `"9999999999.97"` 往復（現状 `Number` 経路では再構成不能な値）、`"0"`/`"0.01"`、スケール超過 `"1.234"` は `InvalidArgumentError`、不正形式は拒否。
  - `Money.fromDecimalString(value: string, currency = Currency.JPY)` を float 非経由で実装（整数部・小数部を文字列分解し通貨スケールへ桁合わせ → 最小単位整数 → `fromMinorUnits`）。
- コミットメッセージ: `feat: #426 Money に文字列から厳密生成する fromDecimalString を追加`

### Step 2: Mapper 読み出しを fromDecimalString 経由へ（#3 本体）
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/mappers/CommonSellingPriceMapper.ts`
- 作業内容:
  - `SellingUnitPrice.fromMajorUnits(Number(row.sellingPrice))` を `SellingUnitPrice.fromMoney(Money.fromDecimalString(row.sellingPrice))` に置換。`::text` から `Money` まで float を経由しない経路にする。
  - 既存の往復統合テストが緑のままであることを確認。
- コミットメッセージ: `fix: #426 共通販売単価の読み出しを float 非経由にし精度を厳密化`

### Step 3: SellingUnitPrice の生成口を fromMoney のみにする
- 対象ファイル: `src/server/subdomains/pricing/domain/values/SellingUnitPrice.ts` と各テスト（`SellingUnitPrice.test.ts`, `CommonSellingPrice.test.ts`, `PrismaCommonSellingPriceRepository.test.ts`）
- 作業内容:
  - `SellingUnitPrice.fromMajorUnits` を削除し、生成口を `fromMoney(Money)` のみにする。
  - テストは `fromMoney(Money.fromMajorUnits(yen))` を包むローカルヘルパへ置換（テスト数値は厳密リテラルで無害）。
- コミットメッセージ: `refactor: #426 SellingUnitPrice の生成を Money 引数に限定し number ドアを廃止`

### Step 4: update を append-only 同期へ簡約（#4）
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository.ts`, `.../prisma/__tests__/PrismaCommonSellingPriceRepository.test.ts`
- 作業内容:
  - 先にテスト（赤）: 「update で既存期間行の `updated_at` を変更しない」を追加（`$queryRaw` で対象行の `updated_at` を前後比較し不変を検証、新規行が増えることも確認）。
  - `update` から `deleteMany`（全削除）を撤去。`writePeriods` の `INSERT` を `ON CONFLICT (id) DO NOTHING` にして、既存行は no-op・新規 id のみ挿入。version 条件付き updateMany（楽観ロック）は維持。
  - 既存の「差分同期」「ConflictError」「EXCLUDE」テストが緑のままを確認。
- コミットメッセージ: `fix: #426 共通販売単価の update を append-only 同期にし updated_at を保持`

### Step 5: insert の P2002 を ConflictError へ翻訳（#1）
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository.ts`, 同テスト
- 作業内容:
  - 先にテスト（赤）: 「同一商品に二重 insert すると `ConflictError`」を追加。
  - `insert` のトランザクションを try/catch し、`Prisma.PrismaClientKnownRequestError && code === "P2002"` を `ConflictError` へ翻訳（既存 `translateInsertConflict` 同型）。EXCLUDE 翻訳は加えない旨をコメントに明記。
- コミットメッセージ: `fix: #426 共通販売単価の二重作成(P2002)を ConflictError に翻訳`

### Step 6: 記録（deviations 更新・learning 追加）
- 対象ファイル: `docs/claude-plans/issue-426/deviations.md`, `learning/price-value-objects-take-money.md`（新規）
- 作業内容:
  - deviations.md: #3「全削除→全挿入」の記述を append-only 同期へ書き換え。#1 で EXCLUDE 翻訳を見送った理由、#3 で `Money.fromDecimalString` を入れ書き込みは現状維持とした判断、SellingUnitPrice の number ドア廃止を追記。
  - learning: 横断原則「価格/金額 VO は常に `Money` を引数に取る」と CostPrice の具体的発見（`Number(Decimal)` 罠・自前 float 検証・#447 で是正）を記録。
- コミットメッセージ: `docs: #426 レビュー対応の逸脱更新と価格VO設計原則をlearningに記録`
