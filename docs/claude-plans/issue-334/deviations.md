# Issue #334 S6 実装の計画逸脱記録

計画 `variation-add-and-duplicate-c3.md` からの逸脱を記録する（CLAUDE.md ルール）。

## 1. ステップ構成を /tdd 前提に再設計（Step 構成の組み替え）

- **元の計画**: Step1〜5＝実装、Step6＝ユニット＋E2E を一括、Step7＝ドキュメント。
- **実際**: ユニットテストを純粋モジュールの各実装スライス（Step1 スキーマ・Step2 写像・複製適格性述語）へ畳み込み、behavior ごとに RED→GREEN。E2E は配線後の独立ステップ（Step6）に分離。
- **理由**: `/tdd` の反・水平スライス則（テストを最後に一括＝crap test 化）に従い、red-green が成立する純粋ロジック層を test-first にした。配線層（Server Action・フォーム・Panel）はユニット不可のため実装先行＋E2E 後追い（選択 B）。

## 2. 複製写像（Step2）が薄いアセンブラに縮小

- **元の計画**: 「改訂明細の改訂列をドロップして通常明細としてプリフィルする」を実装する。
- **実際**: `fromVariationLines` の戻り値型 `WorkingLine` に `revisedDeliveryPrice` フィールドが無く、改訂列は再利用で構造的にドロップされる。よって写像固有の「改訂列ドロップ」ロジックは実装不要で、`toCreateInitialValuesFromVariation` は `fromVariationLines` ＋ 提出区分・全体値引・メモを運ぶだけの薄いアセンブラになった。改訂列ドロップは別 behavior として TDD していない。
- **理由**: 既存部品が既に当該変換を担っており、二重実装は不要。加えて適格性ルール上、改訂先バリは複製元になれないため有効な複製元に改訂列は存在しない。

## 3. 複製適格性述語 isVariationDuplicatable を新設

- **元の計画**: Step5 で「複製ボタンを改訂先タブでは `isVariationEditable` 相当のゲートで非表示」。
- **実際**: 複製適格性の純粋述語 `isVariationDuplicatable`（改訂明細を含まない・状態不問）を `variationEditable.ts` に新設し TDD した。改訂検出を `containsRevisedLine` に抽出して `isVariationEditable` と共有。
- **理由**: 複製適格性は「改訂明細を含まない」のみで、`isVariationEditable`（ACTIVE 必須）とは別条件。無効(INACTIVE)バリも複製元にできる（計画§複製元の適格性）ため、`isVariationEditable` を流用すると有効な複製元を誤って弾く。計画の「相当」表現は不正確だった。

## 4. E2E で「系譜なし」を DB アサートしない

- **元の計画**: E2E で「複製して系譜が作られないこと」を検証。
- **実際**: 系譜なしは DB 直接参照でしか観測できず ADR-0012（テストで Prisma 直接利用禁止）に反するため、E2E では検証しない。UI 観測可能な結果（提出区分固定・内容プリフィル・新タブ出現・複製元不変）のみ E2E で検証し、系譜なしは C3 `AddVariation` の設計上の保証（ドメインユニットテスト済み）に委ねた。
- **理由**: ADR-0012 遵守。

## 5. リダイレクト理由を ESTIMATE_UPDATED で再利用（軽微）

- **元の計画**: 明示なし（「成功で revalidatePath＋redirect」）。
- **実際**: 専用 reason を追加せず C4 と同じ `ESTIMATE_UPDATED` を再利用。
- **理由**: バリ追加も見積集約の更新であり、flash ハンドラへの新規 reason 追加はスコープ外。
