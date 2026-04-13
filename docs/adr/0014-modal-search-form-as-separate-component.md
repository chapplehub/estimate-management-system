# ADR-0014: モーダル用検索フォームを既存SearchFormとは別コンポーネントにする

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-13 |
| 最終更新日 | 2026-04-13 |

## コンテキスト

汎用選択モーダル（`SelectionModal`）内に検索フォームを配置する必要がある。既存の `SearchForm` は URL のクエリパラメータを操作して検索を実行する設計だが、モーダル内ではURL操作は不要で、コールバックベースの検索が求められる。

## 検討した選択肢

### A. 既存 SearchForm を改修して URL / callback 両モード対応にする（不採用）

`SearchForm` に `mode: "url" | "callback"` のような prop を追加し、callback モードでは URL 操作をスキップして `onSearch` を呼ぶ。

### B. モーダル専用の ModalSearchForm を新規作成する（採用）

`SearchFieldDef` 型は共有しつつ、URL操作を行わない独立したコンポーネント `ModalSearchForm` を作成する。Props は `fields`, `onSearch`, `isLoading`。

## 決定

モーダル専用の `ModalSearchForm` を新規作成する（選択肢 B）。`SearchFieldDef` 型のみ既存 `SearchForm` から共有する。

## 根拠

- **責務の分離**: `SearchForm` は `useSearchParams` / `router.push` によるURL操作に特化しており、内部で Next.js の navigation API に強く依存している。callback モードを追加すると条件分岐が増え、両方の振る舞いをテストする必要が生じる
- **共通化すべきは型定義**: フィールド定義（`SearchFieldDef`）は共通だが、検索トリガーの仕組み（URL vs callback）は根本的に異なる。型を共有しつつ実装を分けることで、UIの統一感と実装のシンプルさを両立できる
- **影響範囲の最小化**: 既存の一覧画面（商品・従業員・部署・役職）は `SearchForm` をそのまま使い続けるため、回帰リスクがない

### 不採用理由

- **選択肢 A**: SearchForm の内部に `useSearchParams` を使うパスと使わないパスが混在し、コンポーネントの複雑度が不必要に上がる。将来の修正時に片方のモードだけ壊れるリスクがある

## 影響

- モーダル内で検索フォームが必要な場合は `ModalSearchForm` を使用する
- `SearchFieldDef` 型は両コンポーネントで共通のため、フィールド定義の追加・変更は一箇所で管理できる
- 対象ファイル: `src/app/_components/shared/ModalSearchForm.tsx`, `src/app/_components/shared/SearchForm.tsx`（型の export 元）
