# ADR-0032: 多階層集約の更新は identity 保持の差分 upsert を命令的トランザクションで行う

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-06-02 |
| 最終更新日   | 2026-06-02 |

## コンテキスト

Issue #290 で Estimate 集約（ルート Estimate → 子 EstimateVariation → 孫 EstimateItem → さらに RevisedEstimateItemDetail、加えて修理系 1:1 詳細）の Prisma リポジトリ `save()` を実装した。`save()` は新規作成と更新の双方を担う。

更新時、「集約から消えた子をどう削除し、残った子・新規の子をどう書き戻すか」の戦略を決める必要がある。ここには 2 つの技術的・業務的制約が絡む。

1. **`EstimateVariation` は他テーブルから FK 参照されている**
   - `Order`（受注、`VariationOrder` リレーション、`onDelete` 未指定 = Restrict）
   - `EstimateVariationCopy.sourceVariation`（複製元、Restrict）
   - `EstimateVariationRevision.sourceVariation`（改訂元、Restrict）

   したがって variation を不用意に削除すると FK 違反になる、あるいは参照側を巻き込んで壊す。

2. **Prisma のネスト `upsert` / `deleteMany` は 1 リレーション階層までしか効かない**
   ネスト書き込みで原子的に扱えるのは create のときの任意深さネスト create までで、`update` 文の中でネストした `upsert`/`deleteMany` は直下 1 階層が限界。Estimate → Variation → Item → RevisedDetail という 3〜4 階層の差分を 1 つのネスト `update` で表現できない。

## 検討した選択肢

### A. 全削除 → 再作成（delete-recreate）（不採用）

更新のたびに既存 variation/item を全削除し、集約の現状態から作り直す。コードは単純（`deleteMany` + ネスト create の再利用）。

**問題**:
- `EstimateVariation` を消すと、それを参照する `Order` / `EstimateVariationCopy` / `EstimateVariationRevision` が **FK 制約（Restrict）で削除を拒否、または巻き込んで破壊**する。受注済み・複製元・改訂元になっている見積を編集した瞬間に壊れる。
- 行の identity（id・createdAt）が毎回変わるため、外部参照・監査・楽観ロックの基盤が成立しない。

### B. ネスト upsert に全部任せる（不採用）

`prisma.estimate.update({ data: { variations: { upsert: [...] } } })` のように宣言的ネスト upsert で書く。

**問題**: 前述の通りネスト `upsert`/`deleteMany` は 1 階層しか効かないため、孫（Item）・ひ孫（RevisedDetail）の差分を表現できない。2 階層目以降を宣言的に書こうとすると型・実行ともに破綻する。

### C. identity 保持の差分 upsert を命令的トランザクションで回す（採用）

`prisma.$transaction` 内で、各階層を id をキーに手続き的に突き合わせる:

1. ルートの scalar を `update`
2. 集約から消えた variation を `deleteMany({ estimateId, id: { notIn: 生存variationId } })`
3. 各 variation を id キーで `upsert`（`where: { id }`、create は id+FK 込み、update は scalar のみ）
   - 配下 item も同様に `deleteMany(notIn)` + id キー `upsert`
   - RevisedDetail（1:1）は存在すれば `upsert`、無ければ `deleteMany`
4. 修理系 1:1 詳細は存在する片方を `upsert`、他方を `deleteMany`

これにより**残存する行の id・createdAt は不変のまま**、消えた子だけが消え、新しい子だけが増える。

## 決定

多階層集約の更新は **「`$transaction` 内で、各階層を id キーに突き合わせる identity 保持の差分 upsert」** で行う（選択肢 C）。`deleteMany({ id: { notIn } })` で消えた子を落とし、生存・新規の子は id キーの `upsert` で書き戻す。全削除→再作成は採らない。

## 根拠

### 行 identity を壊さないことが FK 整合の前提

`EstimateVariation` は受注・複製・改訂から参照される「他者から名指しされる」エンティティ。delete-recreate は名指しの宛先を消すため、参照側を壊すか FK で拒否される。差分 upsert なら生存 variation の id が保たれ、参照は有効なまま。これは「子をどう書くか」ではなく「参照網をどう守るか」の判断であり、一言では言い表せない。

### Prisma のネスト書き込みの限界を直視する

ネスト upsert が 1 階層しか効かない以上、3〜4 階層の差分は手続き的に書くしかない。宣言的に書こうとすると 2 階層目で破綻するので、最初から `$transaction` + ループの命令的スタイルを正とする。原子性はトランザクションが担保する。

### 失敗はサイレントにせず顕在化させる

参照中 variation の削除が起きた場合は Prisma の `P2003`（FK 違反）を捕捉し、「他テーブルから参照されているバリエーションは削除できません」という業務的メッセージに翻訳する。整合崩れを静かに飲み込まない。

### 不採用理由まとめ

- **A（delete-recreate）**: FK 参照を破壊し、行 identity も毎回変わる
- **B（ネスト upsert 全任せ）**: ネスト upsert は 1 階層限界で 3 階層差分を表現できない

## 影響

### 今後の多階層集約リポジトリの標準パターン

Order / Invoice / 仕入見積 等、子・孫を持ち外部から FK 参照されうる集約のリポジトリ更新は本パターンを踏襲する。「`$transaction` + 各階層 id キー突き合わせ（`deleteMany(notIn)` + `upsert`）」をテンプレートとする。

### 集約ルートに番号変更 API が無い前提と整合する

本実装の差分 upsert は、`EstimateVariation.variationNumber` のような UNIQUE 制約付き列を**既存行で書き換えない**ことを前提に成立する（`@@unique([estimateId, variationNumber])` への即時衝突を起こさない）。当初計画した「2 フェーズ採番による並べ替え対応」は、DB の `CHECK(1-99)` と非 DEFERRABLE な UNIQUE、およびドメインルートに `changeVariationNumber` が無く並べ替えが到達不能であることから撤去した（詳細は `docs/claude-plans/issue-290/deviations.md`）。将来 variationNumber 変更 API を追加する場合は、DEFERRABLE 化または範囲内サイクル再採番の検討が必要になり、本 ADR の前提を見直す。

### scalar マッピングを create/update で単一情報源にする

`upsert` は create 句と update 句で同じ列集合を要するため、Mapper の scalar ビルダー（`toVariationScalarData` 等、id・FK・タイムスタンプを含まない）を create/update 双方で共有する。列マッピングの二重定義を防ぐ。

### 関連

- `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts` — `save()` / 静的 `update()`
- `prisma/schema.prisma` — `Order` / `EstimateVariationCopy` / `EstimateVariationRevision` の `EstimateVariation` 参照
- ADR-0031 — 同リポジトリの集約再構築（Mapper 例外経路）
- ADR-0033 — 集計値の永続化と再構築時の非再計算
