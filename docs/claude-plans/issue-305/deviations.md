# Issue #305 実装の逸脱記録

## 逸脱1: 計画の Step1〜5 を1コミットへ統合した

### 元の計画
「1 ステップ = 1 コミット」で、Step1（ドメイン IF 分割）〜Step5（プレゼン層）を
それぞれ独立したコミットにする。

### 実際の実装
Step1〜5＋既存テストの version 整合を**1コミット**（`feat: 楽観ロックを department
サブドメインへ適用する`）に統合した。テストの新規追加のみ別コミットに分けた。

### 逸脱の理由
pre-commit フックがプロジェクト全体の `tsc --noEmit` を実行するため、`save` を廃止する
破壊的なインターフェース変更は「IF・Prisma 実装・両コマンド・Server Action・Zod
スキーマ・既存テスト」が揃って初めてコンパイルが通る。途中段階では必ず型エラーになり、
個別コミットできない。

具体的には `actions.ts` が `submission.value.version` を読む以上、`updateDepartmentSchema`
への version 追加と `UpdateDepartmentInput` への version 追加が同一コミットに引き込まれ、
さらに `save` を参照する既存テストの修正も同時に必要になる。これは ADR-0039 が意図した
「expectedVersion を渡さないコードを型で検出する（細目3=A）」の裏返しの帰結であり、
分割不能な原子的単位である。

## 逸脱2: `_shared/error-handler.ts` への ConflictError 分岐追加（タスクリスト外）

### 元の計画（イシューのタスクリスト）
ドメイン IF / Prisma 実装 / コマンド Input / クエリ DTO / 編集フォーム＋Zod / テスト。

### 実際の実装
上記に加え、`handleCommandError` に `ConflictError → error.message` の分岐を追加した。

### 逸脱の理由
ADR-0039 細目5 は競合時のユーザー向け文言を品質要件として定めるが、現状の
`handleCommandError` には ConflictError 分岐が無く、競合が汎用文言
「処理に失敗しました…」へ潰れて要件を満たせない。

estimate（#310）は presentation 層（Server Action / フォーム）が未実装のため、
ConflictError をユーザーへ表面化するこのピースに**未到達**だった。UI を持つ department が
横断ポリシーの最後の配線を初めて埋める形になる。共通ハンドラに置くことで後続サブドメインの
UI 化でも再利用できる。採番衝突（ADR-0035）の ConflictError 文言もそのまま通る。

ユーザーに方針を確認し、共通ハンドラへの追加で合意済み。
