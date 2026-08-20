# Issue #565 自動レビュー＆修正 ラウンド1 修正計画

`/auto-review-fix 570`（深さ medium）のラウンド1で judge が採用した指摘のみを対象とする。
採用①②=0件（収束）／ 採用③=1件。本計画は採用③（cleanup）1件のみ。

## 採用③: `isSoleMember` の逐次2クエリを1クエリに畳む

| 項目 | 内容 |
|---|---|
| バケツ | ③ cleanup（efficiency） |
| severity（参考） | Low |
| file:line | `src/server/subdomains/role/infrastructure/queries/PrismaRoleQueryService.ts:86-96` |
| 問題 | メンバー総数を `count({roleId})` で数え、1件のときのみ `count({roleId, employeeId})` を追加発行する逐次2クエリ。ちょうど1人（=true 経路）で DB 往復が2回発生する。 |
| 修正方針 | `findMany({ where: { roleId }, select: { employeeId }, take: 2 })` 1本に置換し、`rows.length === 1 && rows[0].employeeId === employeeId` で判定する。`EmployeeRole` の複合PK `(employeeId, roleId)` により行重複はないため、0件/2件で false・1件で本人一致判定、という挙動は完全一致する。 |
| 影響範囲 | `PrismaRoleQueryService.isSoleMember` の1メソッドに閉じる。公開シグネチャ不変、呼び出し側の変更なし。 |
| 想定テスト | 既存 `PrismaRoleQueryService.isSoleMember.test.ts`（メンバー0/1/複数・本人/他人の各境界）が緑のまま通ること。 |
| ③採用根拠 | 挙動不変（全境界で同値・既存テスト緑）／ 設計判断不要（単一メソッド内の実装差し替え・置き場所の迷いなし）／ 局所的（1メソッド1ファイル・公開シグネチャ不変）。DB往復 2→1 の純粋 efficiency。 |

## 対象外（④残課題・報告のみ）

- **F1** `UpdateEmployeeCommand.ts:69`「roleId 未指定＝解除」— 計画準拠（ADR-c89/計画 Step3 の #568 接合部）。ただし #568 なし単独デプロイで seed 済み役割保有者の担当役割サイレント消失のリリース順序ハザード。修正せず強調報告。
- **F2** `Employee.test.ts:746` setTimeout 内 expect 無効 — test-coverage 系で①②③非該当。報告のみ。
- **F3** `employeeRoles[0]` orderBy 無し — 却下（計画準拠・ADR は DB バックストップ非設置）。
- **F5** テスト5ファイルのボイラープレート重複 — ③基準未達（定数依存で無状態でない・引数化に設計判断）。
