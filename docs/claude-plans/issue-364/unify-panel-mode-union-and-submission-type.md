# Issue #364: VariationPanel の creating 状態の union 化と submissionType 二重管理の簡素化 — 実装計画

## 概要

S6（PR #362）レビュー finding（A2）の品質改善リファクタ。`VariationPanel` のモード管理が `isEditing`（boolean）と `creating`（`{ initialValues? } | null`）の2つの独立 state に分かれており、排他のはずが型で排他が表現されていない。さらに「新規追加（白紙）」と「複製プリフィル」を `initialValues` の有無で暗黙区別している。これらを単一の判別共用体へ統合し、排他性・分岐の網羅性を型で担保する。あわせて `VariationCreateForm` の `submissionType` 二重管理（React state ＋ submit 用 hidden）を解消する。

スコープは2ファイルに完全に閉じる（`VariationPanel.tsx` / `VariationCreateForm.tsx`）。`VariationCreateInitialValues` 型と `toCreateInitialValuesFromVariation` は形を変えないため `variationDuplication.test.ts` はそのまま緑。コンポーネント単体テストは存在せず、安全網は TypeScript の網羅性検査 ＋ E2E（estimates-variation-create / -edit）の二段。

## 設計判断

### パネル状態 union の形（合意済み）
- A. フラット4バリアント union・discriminant 名 `kind`
- B. ネスト union（`{ kind: "create"; source: {...} }`）
- C. Issue 例どおり discriminant 名 `mode`
- **採用: A**。既存コード（`variationLines.ts` の `WorkingNode`、`variationSchema.ts` の `nodeSchema`）が判別子に一貫して `kind` を使っており語彙を統一できる。ネストは switch が2段になり網羅性チェックの利点が薄れる。

```ts
type PanelMode =
  | { kind: "view" }
  | { kind: "edit" }
  | { kind: "create-new" }
  | { kind: "create-duplicate"; initialValues: VariationCreateInitialValues };
```
- `view` / `edit` は素のタグ（編集対象は `activeIndex` から導く `active` を読むため追加データ不要）。`create-duplicate` のみ複製元スナップショット `initialValues` を変種に同梱し、データがタグと一緒に運ばれる形にする。
- `activeIndex` / `activeRowId` は union とは直交する関心事（どのタブか・どの行が選択中か）なので union に含めず別 state で現状維持。

### VariationCreateForm の props 形状（合意済み）
- A. props も判別共用体 `{ kind: "new" } | { kind: "duplicate"; initialValues }` に揃える
- B. 現状どおり `initialValues?`（optional）のまま、パネル内部だけ union 化
- **採用: A**。`isDuplicate = initialValues !== undefined` の暗黙導出が消え、複製時のみ `initialValues` が型上存在することが保証される（新規時に誤参照するとコンパイルエラー）。discriminant 名はパネルと揃えて `kind`（`create-new`↔`new`、`create-duplicate`↔`duplicate`）。

### submissionType 二重管理の解消（合意済み）
- A. `useState` を撤廃し uncontrolled 化（複製＝hidden 固定値／新規＝`defaultValue` 付き uncontrolled select）
- B. state を残したまま props union 化だけ行う
- **採用: A**。`submissionType` はライブプレビュー（明細金額計算）に影響しないため controlled state にする実需がない。バリデーションは `addVariationNodeSchema` の `submissionType` enum が担う。`value`/`onChange` の往復が丸ごと消え「複製＝固定値を運ぶ／新規＝選ぶ」の分岐が素直になる。
- 留意: conform の再検証時に新規 select の選択値が保たれるよう `useServerForm` の `defaultValue` に `submissionType: "CUSTOMER"` を含める。実装後 E2E で「新規で DELIVERY_LOCATION を選択して保存」経路を必ず緑確認する。

### ドキュメント更新（合意済み）
- CONTEXT.md: 更新不要（新ドメイン用語なし。複製/新規追加/提出区分は既出。UI 状態表現の整理であり用語集の関心事ではない）。
- ADR: 不要（局所的 UI リファクタで容易に巻き戻せ、union 化は既存 `kind` 規約の踏襲。提出区分の不変性は ADR-0045 が記録済み）。

## ステップ

### Step 1: VariationPanel のモードを単一 union に統合
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`
- 作業内容:
  - `isEditing` / `creating` の2 state を `PanelMode`（フラット4バリアント union・discriminant `kind`）1つへ置換
  - 状態遷移を等価で移植: 編集→`{ kind: "edit" }`、複製→`{ kind: "create-duplicate", initialValues: toCreateInitialValuesFromVariation(active) }`、追加→`{ kind: "create-new" }`、キャンセル／タブ切替後→`{ kind: "view" }`
  - 操作行の表示条件 `!isEditing && !creating` → `mode.kind === "view"`、破棄確認 `(isEditing || creating)` → `mode.kind !== "view"`
  - `create-duplicate` / `create-new` に応じて `VariationCreateForm` へ判別共用体 props を渡す
  - `activeIndex` / `activeRowId` は現状維持
- コミットメッセージ: `refactor: VariationPanel のモードを単一判別共用体に統合`
  - body 例: 「isEditing(boolean) と creating(optional) の2 state を kind 判別の union 1つへ。理由: 排他性と複製/新規の区別を型で担保するため。discriminant は既存 WorkingNode/nodeSchema に揃え kind を採用」

### Step 2: VariationCreateForm の props union 化と submissionType 簡素化
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/VariationCreateForm.tsx`
- 作業内容:
  - props を `{ kind: "new" } | { kind: "duplicate"; initialValues }` 判別共用体へ変更し `isDuplicate = initialValues !== undefined` 導出を削除
  - `submissionType` の `useState` を撤廃。複製＝固定ラベル表示＋hidden（`initialValues.submissionType`）、新規＝`defaultValue` 付き uncontrolled select
  - `useServerForm` の `defaultValue` に `submissionType: "CUSTOMER"` を追加
  - `SubmissionTypeField` を新 props 形状に合わせて簡素化
- コミットメッセージ: `refactor: VariationCreateForm の props union 化と submissionType 二重管理を解消`
  - body 例: 「props を kind 判別共用体化し submissionType の useState を撤廃。理由: プレビューに影響せず controlled の実需がないため uncontrolled 化。複製=固定/新規=選択の分岐を素直に」

### Step 3: 検証
- 作業内容:
  - `pnpm lint` / `pnpm test`（既存ユニット緑のまま）
  - `pnpm e2e`（estimates-variation-create.e2e.ts / estimates-variation-edit.e2e.ts 緑。特に新規で DELIVERY_LOCATION 選択保存・複製時の引き継ぎ固定・タブ切替破棄確認の等価性を確認）
- コミットメッセージ: （検証のみ・コード変更が生じた場合のみ該当 Step に含める）
