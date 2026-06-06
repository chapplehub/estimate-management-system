# ADR-0035: 採番の同時並行一意性は MAX(sequence)+1 + unique 制約 + 手動リトライで担保する

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-06-06 |
| 最終更新日   | 2026-06-06 |

## コンテキスト

Issue #293 で見積番号の採番ポート `EstimateNumberIssuer` の Prisma 実装
（`PrismaEstimateNumberIssuer`）を実装した。これは ADR-0026 が VO の責務外として
リポジトリ層へ分離した「連番の払い出し」の具体実装にあたる。

ADR-0026 の「影響」節は、採番の同時並行一意性の実装方式について次のように明示的に
判断を先送りしていた:

> 「連番の同時並行採番に対する一意性担保」の実装方式（リトライ vs カウンタテーブル vs
> RETURNING）は本 ADR のスコープ外。**インフラ実装時に別 ADR を起票するか、コミット
> ボディに記録する**

見積番号の仕様（システム設計書 §2）:
- 形式: `[接頭辞 1][年度 2][連番 5]` = 8 文字（例: `N2500001`）
- 連番は `fiscalYear + estimateType` 単位で年度ごとリセット、**欠番許容**（§2.2）
- **削除された番号は再利用しない**（§2.2）
- 採番タイミングは見積保存時（C1 `CreateEstimate`）

スキーマ上、見積番号は `estimate_number @unique`（= `(estimateType, fiscalYear,
sequence)` 相当）で一意性が保証される。年間の見積件数は同一 `(年度・区分)` で
〜1,000 件規模であり、同一区分・同時刻の並行作成は極めて稀。

加えて、**見積は物理削除を想定しない運用方針**である（`delete()` はインターフェース・
実装に存在するがアプリ層から未使用であり、論理削除列も持たない）。

## 検討した選択肢

### A. MAX(sequence)+1 + `@unique` + 衝突時 ConflictError → 手動リトライ（採用）

```typescript
// PrismaEstimateNumberIssuer
const latest = await prisma.estimate.findFirst({
  where: { fiscalYear: fiscalYear.value, estimateType: estimateType.value },
  orderBy: { sequence: "desc" },
  select: { sequence: true },
});
const nextSequence = (latest?.sequence ?? 0) + 1;
// → prefix + year2 + seq5 を組み立て、EstimateNumber.parse() で検証して返す
```

採番は楽観的に「現時点の最大連番 + 1」を返す。一意性の最終保証は
`estimate_number @unique` が担う。並行作成で同一連番が払い出された場合は INSERT 時に
Prisma `P2002` が発生し、これを infrastructure 層（`PrismaEstimateRepository.save`）で
アプリ層の `ConflictError` に翻訳する。プレゼンテーション層は「登録が競合しました。
もう一度登録してください」と表示し、ユーザーに再登録を促す（手動リトライ）。

### B. 専用カウンタテーブルで原子的にインクリメント（不採用）

`EstimateNumberSequence(fiscalYear, estimateType, lastSequence)` のような専用テーブルを
設け、`UPDATE ... RETURNING` で原子的に次連番を採番する。

- 並行作成でも採番段階で直列化され、衝突がほぼ起きない
- ただし**見積本体テーブルとは別ソース**になり、両者の同期問題（カウンタだけ進んで
  見積 INSERT が失敗した場合の不整合、既存データ・シードとの初期値合わせ）を抱える
- マイグレーション（新テーブル追加）が必要で、issue スコープを超える

### C. `INSERT ... RETURNING` で連番をデータベース側採番（不採用）

シーケンスや採番関数を DB 側に持ち、INSERT 時に連番を確定させる。

- `(年度・区分)` ごとにリセットする連番をネイティブシーケンスで表現するのは煩雑
  （年度・区分の組ごとにシーケンスを作る／関数で管理する必要がある）
- ドメイン層が払い出した `EstimateNumber` を集約生成前に確定させる現行フロー
  （ADR-0026: アプリ層が issuer から番号を得て集約に渡す）と噛み合わない

## 決定

採番の同時並行一意性は **MAX(sequence)+1 による楽観的採番 + `estimate_number @unique`
による最終保証 + 衝突時の `ConflictError` 表面化による手動リトライ**で担保する。
専用カウンタテーブル・DB 側採番は導入しない。

## 根拠

### 物理削除しない運用方針が「連番再利用なし（§2.2）」を実運用上充足する

見積を物理削除しない以上、`MAX(sequence)` は単調増加する。欠番（採番後に保存失敗した
番号）は生じ得るが、最大連番は減らないため**削除番号の再利用は構造的に起こり得ない**。
これは §2.2「欠番許容・削除番号は再利用しない」をそのまま満たす。専用カウンタを持たずとも
仕様を充足できることが、MAX+1 を選ぶ最大の根拠である。

### 一意性は常に `@unique` が保証するためデータ破損が起きない

どの採番方式でも、最終的なデータ整合性は `estimate_number @unique` が保証する。
MAX+1 が稀に同一連番を払い出しても、INSERT が `P2002` で弾かれるだけでデータは壊れない。
「正しさ」は制約に委ね、「採番」は楽観的に行う、という責務分離が成立する。

### 衝突頻度が低く、手動リトライのコストが専用テーブルのコストを下回る

同一 `(年度・区分)` で同時刻に複数ユーザーが登録する状況は年間〜1,000 件規模では極めて
稀。専用テーブルの新設（マイグレーション・別ソース同期・初期値整合）が恒常的に負う複雑さ
よりも、稀な衝突時にユーザーへ再登録を促す運用のほうが総コストが小さい。

### 既存データ・シードとの不整合を避けられる

既存テスト／シードは `EstimateNumber` を issuer を通さず直接生成している。MAX+1 は常に
**実在行の最大連番**を参照するため、これらと不整合を起こさない。専用カウンタは別ソースで
あるがゆえに初期値同期の問題を持ち込む。

### ポート抽象により将来の方式差し替えがコマンド無変更で可能

採番は `EstimateNumberIssuer` interface 経由で DI される（ADR-0026）。将来 §2.2 の厳密
準拠や高並行性が要求された場合でも、`PrismaEstimateNumberIssuer` を選択肢 B/C の実装に
差し替えるだけでよく、`CreateEstimateCommand` をはじめアプリ層は無変更で済む。本決定は
「現時点で最小コストの実装」を選ぶものであり、将来の選択肢を狭めない。

### 不採用理由まとめ

- **B（専用カウンタテーブル）**: 別ソース同期・マイグレーション・初期値整合のコストが、
  稀な衝突を防ぐ便益に見合わない
- **C（DB 側採番）**: 年度・区分ごとリセットの連番表現が煩雑で、採番を集約生成前に確定
  させる現行フロー（ADR-0026）と整合しない

## 影響

- **採番は楽観的 MAX(sequence)+1**。`PrismaEstimateNumberIssuer` は専用テーブルを持たず、
  `estimate` を `(fiscalYear, estimateType)` で絞った最大連番 + 1 を返す
- **連番衝突（`P2002`）は infrastructure 層で `ConflictError`（application 層）へ翻訳**し、
  プレゼンテーション層で「再登録を促す」UI に対応付ける（Prisma 固有エラーを上位に漏らさ
  ない / ADR レイヤリング方針）
- **コマンド内での自動リトライは行わない**。ユーザーによる手動リトライ方針とする
- **本決定は「物理削除しない運用方針」に依存する**。将来、見積の物理削除・論理削除・番号
  再利用の要件が生じた場合、§2.2 充足の根拠が崩れるため本 ADR を見直し、選択肢 B/C への
  差し替えを検討する（ポート抽象により差し替えは局所化される）
- **連番上限（99999）超過は `BusinessRuleViolationError`**（年度内採番枠の枯渇 = ドメイン
  不変条件違反）として扱う
- 関連: ADR-0026（採番 VO の責務分離・本 ADR の先送り元）、ADR-0012（採番ロジックのテスト
  は実 DB 統合テストで行う）、`src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer.ts`、
  `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`（P2002 翻訳）、
  `docs/business/estimate/システム設計書(見積).md` §2.2
