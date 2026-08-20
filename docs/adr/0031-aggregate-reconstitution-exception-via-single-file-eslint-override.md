# ADR-0031: 集約再構築の例外経路を Mapper 限定の ESLint オーバーライドで開ける

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-06-02 |
| 最終更新日   | 2026-06-02 |

## コンテキスト

ADR-0027 で Estimate 集約の境界を「バレル非公開 + ESLint `no-restricted-imports` で子エンティティの import を構造的に禁止」する形で確定した。その「影響 > リポジトリ実装時の例外経路（次イシュー以降の課題）」で、**永続化から集約を再構築する際にだけは子エンティティへのアクセスが必要**という未決事項が明示的に先送りされていた。Issue #290（Prisma リポジトリ実装、着手順序 #5）でこの宿題に答える必要が生じた。

問題の本質は次の非対称性にある:

- 集約境界規約により、集約外コードは `EstimateVariation` / `EstimateItem` / 修理詳細群を import できない（mutator への到達経路を断つため）。
- しかし `EstimateMapper.toDomain()` は Prisma レコードから集約を組み立て直すため、子エンティティの `reconstruct()` を**必ず呼ばねばならない**。これは集約境界規約と正面から衝突する、infrastructure 層の正当な要請である。

ADR-0027 が挙げた選択肢は以下の 3 つだった。

- (a) リポジトリ/Mapper を `entities/` 配下に置く（オーバーライドが効くので import できる）
- (b) `entities/internal.ts` のような内部用バレルを用意し、リポジトリにだけアクセス許可する
- (c) 集約ルートに `reconstructAggregate(snapshot)` 静的ファクトリを用意し、リポジトリはルートに丸投げ

## 検討した選択肢

### A. Mapper を `entities/` 配下に置く（不採用 = ADR-0027 案 a）

ESLint オーバーライド（`entities/**` は `no-restricted-imports` off）に乗るので子を import できる。

**問題**: `EstimateMapper` は Prisma 型（`Prisma.Decimal` / `Prisma.EstimateGetPayload`）に依存する infrastructure の住人。これを domain の `entities/` に置くと **DDD レイヤリング規約（domain は Prisma に依存しない）を破る**。境界規約を守るためにレイヤリング規約を破る本末転倒。

### B. 内部用バレル `entities/internal.ts` + パス制限ルール（不採用 = ADR-0027 案 b）

子を internal バレルから export し、リポジトリ系ディレクトリにだけ import を許可する ESLint ルールを足す。

**問題**: 「誰に許すか」のホワイトリストを ESLint の `overrides` で二重管理することになり、対象が増えるたびに internal バレルの export と許可パスの両方を保守する必要がある。バレルを一枚増やす構造コストの割に、得られる隔離は選択肢 D と変わらない。

### C. ルートに `reconstructAggregate(snapshot)` 静的ファクトリ（不採用 = ADR-0027 案 c）

集約ルート `Estimate` に「DB スナップショット → 集約」の静的ファクトリを置き、子の組み立てを全部ルート内部に閉じ込める。リポジトリはルートに丸投げするので子を import しない。

**問題**:
- 「Prisma の行形状」を引数に取ると domain がリポジトリのクエリ形状（`ESTIMATE_FULL_INCLUDE` の戻り型）を知ることになり、依存方向が逆流する。Prisma 非依存の中立 snapshot 型を別途定義すると、結局 Prisma 行 → snapshot → 集約の二段変換になり、Mapper を domain に押し込んだだけで変換責務は消えない。
- ルートが全子・孫の reconstruct 手順を抱え、肥大化する。マッピングは本来 infrastructure の関心事。

### D. Mapper を infrastructure に置いたまま、当該ファイル限定で ESLint をオーバーライド（採用）

```javascript
// eslint.config.mjs（末尾オーバーライド）
{
  files: ["src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts"],
  rules: { "no-restricted-imports": "off" },
},
```

`EstimateMapper.ts` という**単一ファイルにだけ**境界規約の穴を開け、そこで子エンティティの `reconstruct()` を直接呼ぶ。レイヤリング規約（infrastructure に居る）も境界規約（例外は 1 ファイルに局所化）も両立する。

## 決定

集約再構築の例外経路は **「Mapper を infrastructure に置いたまま、`eslint.config.mjs` で当該 Mapper ファイル 1 つに限定して `no-restricted-imports` を off にする」** で開ける（選択肢 D）。

前提として、子エンティティ・集約ルートは**永続化からの復元口として `reconstruct()` を public 静的メソッドで公開する**。`create()`（新規生成・不変条件を検証し集計を計算）と `reconstruct()`（保存済みの値をそのまま組み立て直す）を役割分担させる。

## 根拠

### 例外は「消す」のではなく「最小範囲に局所化して可視化する」

集約再構築という要請は infrastructure に正当に存在し、消すことはできない。であれば、例外を 1 ファイルに閉じ込め、ESLint 設定上に明示的なオーバーライドとして**目に見える形で残す**のが最も誠実。`EstimateMapper.ts` 冒頭にも例外の理由をコメントで明記し、レビュー時に「なぜここだけ子を import できるのか」が即わかる。

### レイヤリング規約と境界規約のどちらも破らない

選択肢 A はレイヤリング規約を破り、選択肢 C は依存方向を逆流させる。D だけが両規約を保ったまま要請を満たす。「2 つの規約が衝突したとき、両方を保てる最小の穴を開ける」が判断軸。

### 構造コストが最小

選択肢 B（internal バレル）に比べ、バレルを増やさず ESLint 1 ブロックで済む。許可対象が「Mapper のみ」と明確で、ホワイトリストの二重管理が不要。

### 不採用理由まとめ

- **A**: 境界規約を守るために DDD レイヤリング規約を破る本末転倒
- **B**: internal バレルと許可パスの二重管理。隔離効果は D と同等で割に合わない
- **C**: domain がクエリ形状を知る依存逆流、またはルートの肥大化を招く

## 影響

### 今後の全集約で踏襲する例外パターン

Order / Invoice / 仕入見積 等、今後の多階層集約のリポジトリ実装でも同じ判断を適用する。各集約は `infrastructure/mappers/<Aggregate>Mapper.ts` を 1 ファイル用意し、そのファイルにだけ ESLint オーバーライドを足す。例外は常に「Mapper 1 ファイル」に閉じる。

### `reconstruct()` を全エンティティに用意する責務

集約ルートと全子・孫エンティティに `reconstruct()`（保存済み値からの復元・不変条件の再検証はせず値をそのまま受け取る）を public 静的メソッドとして実装する。`create()` との役割分担を明確にする。

### 集約リポジトリのテスト用ビルダーは `entities/__tests__/` に置く（候補5の内包）

リポジトリのテストも集約外コードであり、境界規約により子エンティティを import して有効な集約を組み立てられない。これを回避するため、**テスト用集約ビルダーを `entities/__tests__/` 配下に置く**（ADR-0027 のオーバーライドで相対 import が効くため、ここでは子を組める）。ビルダーは `Estimate`（集約ルート）を返し、infrastructure 配下のリポジトリテストはそのルートだけを受け取る。

- 実装例: `src/server/subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder.ts`（`buildNewEstimate` / `buildRepairEstimate` / `buildAfterRepairEstimate` 等）
- これは Mapper 例外（本 ADR 本体）とは別経路だが、いずれも「ADR-0027 の境界規約を守りつつ、集約外から集約を構築する正当な必要にどう応えるか」という同じ問いへの答えなので、本 ADR に内包する。

### 関連

- `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts` — 本例外の実装。冒頭コメントで例外理由を明記
- `eslint.config.mjs:158-162` — Mapper 限定のオーバーライド
- ADR-0027 — 集約境界の構造的強制（本 ADR が残した「例外経路」の宿題を解決）
- ADR-0032 — 同リポジトリの更新永続化戦略
