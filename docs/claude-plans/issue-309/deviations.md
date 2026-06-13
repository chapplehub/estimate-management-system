# Issue #309 実装計画からの逸脱記録

## 逸脱1: 削除フォームの version 受け取りで Zod スキーマを新設しなかった

- **元の計画内容**: issue 実装タスクの「削除 UI に version を持ち回り、**Zod スキーマに version を追加する**」。
- **実際の実装内容**: Zod スキーマは新設せず、削除アクション内でフォーム由来の version を直接読んでコマンドへ素通しした（5サブドメイン全て）。当初は素の activate/deactivate に倣い `Number(formData.get("version"))` をノーガードで渡していたが、レビュー指摘を受け、より堅牢な `deactivateWithReplacement` に合わせて手動ガード（`typeof versionRaw !== "string" || !Number.isInteger(...)` で不正値を「不正なリクエストです」として早期 return）を5アクション全てに追加した。Zod を使わない方針は維持。
- **逸脱の理由**: 削除アクションはそもそも Zod を使っておらず、最も近い手本である状態変更アクション（activate/deactivate）も `Number(formData.get("version"))` で直接読んでいる。削除フォームは id+version の2項目のみで、多フィールドの更新フォームより状態変更フォームに構造が近い。同じ詳細ページの `actions.ts` 内でパターンを揃え、2項目フォームのために 6つの Zod スキーマファイルを増やすのを避けた。grill-with-docs セッションで合意済み。

## 逸脱2: Employee を本イシューの対象から除外し別イシュー（#337）へ分離した

- **元の計画内容**: issue 概要の「対象コマンド」に `DeleteEmployeeCommand` を含む6コマンド。
- **実際の実装内容**: customer / delivery-location / department / role / product の5サブドメインのみを本イシューで実装。`DeleteEmployeeCommand` は #337 として分離し、未着手のまま残した。
- **逸脱の理由**: `DeleteEmployeeCommand` は削除前に `removeUser`（better-auth の認証ユーザーを Prisma トランザクション外で物理削除する補償不能な外部副作用）を実行する。version チェックを末尾に素通しで足すと、stale 削除の競合時に「認証ユーザーを消した後に ConflictError」となり認証ユーザーが孤児化する新規バグを作り込む。対処には「version 付き delete を先行させ成功時のみ removeUser」という順序設計（A2）が必要で、他5サブドメインの一本道と構造が異なる。同種の順序問題は UPDATE 系（#304）が既に対症療法で解決済みであり、集約境界の根本再設計は #317 が所有する。これらと連動させるため別イシューへ切り出した。grill-with-docs セッションで合意済み。

## 補足: issue 記載の UI 前提との差異（逸脱ではなく前提の明確化）

- issue は「削除 UI（**一覧・詳細**の削除ボタン／**確認ダイアログ**）」と記載していたが、実コードでは削除ボタンは**詳細ページのみ**に存在し（一覧 `columns.tsx` に削除ボタンは無い）、**確認ダイアログも存在しない**。詳細ページは version を含む DTO を既にロード済みのため、version の持ち回りは詳細ページの削除フォームへの prop 追加のみで完結した。
- クエリ側 DTO は5サブドメイン全てで version 保持済みだったため、DTO への version 追加作業は発生しなかった。
