# Issue #568 auto-review-fix ラウンド1 修正計画

`/code-review medium` → judge 評価で **採用①②=1件 / 採用③=1件** を修正対象とする。却下④（4件）は Phase 6 サマリで報告のみ。

## 対象1: ① correctness — Create フォームの defaultValue が担当役割をサイレントに消す

- バケツ: ① correctness / severity(参考): High
- file:line: `src/app/(features)/employees/new/EmployeeCreateForm.tsx:150`
- 問題: `<select {...getSelectProps(fields.roleId)} defaultValue="">` の spread 後 `defaultValue=""` が、サーバ検証エラー再描画時に conform が再投入する submitted 値を上書きし、選択済み担当役割が「（担当役割なし）」に戻る。ユーザーが役割を選択→他項目の検証エラーで再描画→再送信すると役割なしで作成されるデータ不整合。
- 修正方針: `defaultValue=""` を削除し、conform の再投入（getSelectProps 由来の defaultValue）に委ねる。先頭に `<option value="">（担当役割なし）</option>` があるため初期未選択の挙動は不変。更新フォーム（EmployeeUpdateForm.tsx）が既に inline defaultValue を付けていない流儀に統一する。
- 影響範囲: 単一 select 要素のみ。初期描画は先頭 option により value="" のまま（挙動不変）。エラー再描画時のみ挙動が正される。
- 想定テスト: `EmployeeCreateForm.test.tsx` の既存「担当役割セレクトが表示され…既定値 ""」テストが緑のまま。回帰確認は `pnpm test` 全体。

## 対象2: ③ efficiency — page.tsx の逐次 await を並列化

- バケツ: ③ efficiency / severity(参考): Low
- file:line: `src/app/(features)/employees/[employeeCd]/page.tsx:29-41`
- 採用根拠(③): 挙動不変（findAll と isSoleMember は独立した読み取りクエリ）・設計判断不要（Promise.all への機械的変換・置き場所は同一関数内に一意）・局所的（単一関数・シグネチャ不変・レイヤ非越境）。
- 問題: `findAll` を await 完了後に `isSoleMember` を await しており DB 往復が直列。isSoleMember は roles に非依存。
- 修正方針: `Promise.all([findAll(...), employee.assignedRoleId ? isSoleMember(...) : Promise.resolve(false)])` で並列化。roles の map 整形は Promise.all 後に行う。
- 影響範囲: `[employeeCd]/page.tsx` の Page 関数内のみ。返り値・props は不変。
- 想定テスト: page はサーバコンポーネントで単体テスト無し。挙動不変のため `pnpm test`（既存 EmployeeUpdateForm テスト）緑＋ `pnpm lint` で担保。

## 修正順

1. 先に ① EmployeeCreateForm.tsx（`fix:`）
2. 次に ③ page.tsx（`refactor:`）
3. 計画ファイル自体は `docs:`
