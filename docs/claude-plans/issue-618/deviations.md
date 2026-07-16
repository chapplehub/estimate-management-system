# Issue #618: 実装計画からの逸脱

## 1. eslint の naming-convention に `data-*` 除外を追加した

- **元の計画**: Step 1 の対象ファイルは `DataTable.tsx` / `SelectionModal.tsx` / `SelectionModal.test.tsx` の3つ。
  `getRowAttributes?: (row: TData) => { className?: string; "data-invalid"?: boolean }` を追加する、とだけ規定していた。
- **実際の実装**: 上記に加えて `eslint.config.mjs` に以下の除外規則を追加した。

  ```js
  {
    selector: ["objectLiteralProperty", "typeProperty"],
    format: null,
    filter: { regex: "^data-", match: true },
  }
  ```

- **逸脱の理由**: 計画（および ADR-20260716-r4d）が定めた戻り値の形状は `data-invalid` を**オブジェクトのキー**に持つが、
  リポジトリの `@typescript-eslint/naming-convention` は `objectLiteralProperty` / `typeProperty` に camelCase|UPPER_CASE を
  強制しており、`data-invalid` がエラーになった（pre-commit で発覚）。`data-*` は HTML の命名規約でありケバブケースが正で、
  camelCase 化できない。既存の `LineEditTable` は `data-active` / `data-kind` を **JSX 属性**として書いているためこの規則に
  触れておらず、前例が無かった。
  計画の形状を変えて回避する案（例: `isInvalid?: boolean`）も検討したが、「`DataTable` に『無効』の意味を持ち込まない」という
  ADR の意図に照らして改善にならず（どちらもキー名に invalid が出る）、ADR が明示した契約を実装都合で曲げることになるため、
  規則側に限定的な除外を入れる方を選んだ。除外は `^data-` に前方一致するキーのみに限定している。

## 2. スナップショット/展開が取得できない商品が混ざった場合の扱いを決めた

- **元の計画**: Step 2 の相1（`Promise.all` で展開/スナップショット取得）と相3（販売単価の検証）は規定していたが、
  `getProductLineSnapshot` / `expandSetComponents` が `null` を返した場合（商品の並行削除等）の扱いは規定していなかった。
- **実際の実装**: 1件でも `null` が混ざったら、`SelectionRejection` を返さずに**何も追加せず黙って戻る**（no-op）。
- **逸脱の理由**: 修正前のコードは単一選択で `if (!snapshot) return;` / `if (!expanded) return;` として
  「何も追加せず・エラーも出さない」no-op だった。この既存挙動を素直に一括へ一般化すると「1件でも取得不能なら
  1件も追加しない」となり、Step 2 が掲げる原子性とも一致する。ここで新たにエラー文言を設計するのは
  「計画に無い設計判断を足さない」という規約に反するため、既存挙動の温存を選んだ。
  なお販売単価の解決不能（計画が規定した本題）は従来どおり `SelectionRejection` で拒否する。
