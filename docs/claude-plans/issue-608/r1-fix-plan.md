# Issue #608 自動レビュー修正計画 — ラウンド1

`/auto-review-fix` ラウンド1（深さ medium）の judge 採用指摘に対する修正方針。

## 対象（採用③ cleanup のみ）

### 指摘3: roleNames テストの用途キー未使用・位置インデックス依存

| 項目 | 内容 |
|---|---|
| バケツ | ③ cleanup |
| severity(参考) | Low |
| file:line | `src/server/subdomains/employee/infrastructure/queries/__tests__/PrismaEmployeeQueryService.roleNames.test.ts:20` ほか本文中の `TEST_ROLE_CDS[n]` 参照箇所 |
| 問題 | レジストリ `roleTestCodes["employee.roleNames"]` は用途キー `assignedRole`/`seniorRole`/`leafRole` を宣言し型付きで公開しているのに、消費側は `codes` 配列の位置インデックス（`[0]`/`[1]`/`[2]`）に依存。宣言した意味的用途キーが未使用（デッドAPI）で、レジストリの宣言順を並べ替えると assignedRole/senior/leaf の対応が静かにずれる暗黙の順序契約に頼っている。 |
| 修正方針 | 本文中で `TEST_ROLE_CDS[0/1/2]` を意味的に参照している箇所を、派生索引の用途キー（`roleTestCodes["employee.roleNames"].assignedRole` 等）で引く形に置換する。cleanup 用の一括削除は引き続き `codes`（＝`TEST_ROLE_CDS`）を使う。同一コード文字列を返すため挙動は不変。 |
| 影響範囲 | 単一テストファイル `PrismaEmployeeQueryService.roleNames.test.ts` に閉じる。公開シグネチャ変更なし。レイヤ/集約をまたがない。 |
| 想定テスト | 既存の当該テストが緑のまま通ること（`pnpm test` 該当ファイル）。挙動不変の確認。 |
| 採用根拠（③基準） | (1) 挙動不変: 用途キーは同一コード文字列を返す純粋な参照置換。(2) 設計判断不要: 用途キーは既存の意図された公開API、置換先が一意に定まる。(3) 局所的: 単一ファイル内・公開シグネチャ不変。 |

## 修正順

- ①②は採用0件のため、③（本件）のみを実施する。

## 検証

- `pnpm test`（該当ファイル）緑を確認 → 挙動不変を実証。
- `pnpm lint` 緑。
