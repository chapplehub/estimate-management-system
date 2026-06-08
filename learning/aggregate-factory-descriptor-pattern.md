# 多階層集約のコマンドにおける Descriptor パターンの正当性

作成日: 2026-06-06

## 概要

複数エンティティを持つ集約ルート（Estimate）の作成コマンドを実装する際、アプリ層に
`EstimateItemDescriptor` / `EstimateVariationDescriptor` / `RepairDetailDescriptor` 等の
「〜Descriptor」型が複数登場した。これらが **DDD として正当な手法か、それともプロジェクトの
制約（集約外から子エンティティを new できない）を回避するためのハックか** を検討した記録。

**結論: 正当な設計手法。ハックではない。**

ただし「Factory そのもの」と「Descriptor という入力形式」は分けて評価する必要がある。

## 詳細

### 1. Factory 自体は教科書通り（Evans の Factory パターン）

`EstimateFactory` は Eric Evans『DDD』の Factory パターンそのもの。複雑な集約の生成責務を
専用オブジェクトに移し、集約ルートの `create()` は不変条件の検証に専念させる。
多階層集約の「VO の束 → 子エンティティ → 集約ルート」の組み立てを閉じ込めるのは推奨形。

補足: このプロジェクトは集約のライフサイクル入口を2本に割っている。
- 新規生成 → `EstimateFactory` 経由
- 永続化からの復元(reconstitution) → `EstimateMapper.ts` が子の `reconstruct()` を直接呼ぶ
  （eslint の no-restricted-imports をこの1ファイルのみ例外化。穴を1ファイルに閉じ込める規律）

### 2. Descriptor の正体 = 2つの規約が交わる必然的な「継ぎ目」

Descriptor はパターン名でいえば **Parameter Object**、より具体的には
**「VO で構成された生成用スペック(creation spec)」**。

以下2つの規約を同時に満たすと、アプリ層の手元に「VO までは組み上がっているが、
まだエンティティではないデータの束」が必然的に残る。それが Descriptor。

| 規約 | 効果 |
|---|---|
| ① アプリ層が primitive → VO 変換を担当する | アプリ層は VO は作れる |
| ② アプリ層は子エンティティを直接 new できない（eslint で禁止） | アプリ層は子 Entity を作れない |

```
[primitive] →(規約①:アプリ層)→ [VO Descriptor] →(規約②の壁の向こう:Factory)→ [子Entity → 集約Root]
  string                        ItemName等の束                                EstimateItem
```

ポイント:
- Descriptor は **不変条件を一切持たない単なるデータ**。検証は `EstimateItem.create()` /
  `Estimate.create()` 側にある。よってアプリ層が Descriptor を組むのはデータ整形にすぎず、
  ドメインルールの漏洩ではない。
- 通常の DTO は primitive で作るが、この Descriptor は **VO で構成**されている点が一段上等。

### 3. 「ハックか正当か」の判定テスト

> その手法は、回避しようとした境界を結局は守っているか? それとも穴を開けているか?

- ハックの典型: `as any` キャスト / 子を index.ts から再 export して実質公開 /
  eslint を行コメントで握りつぶす → **境界を破る**
- Descriptor: 子エンティティ型を一切外部へ露出しない・完全型安全・eslint も無効化しない
  → **境界を守ったまま目的を達成** → 正当

### 4. コスト（本当の論点）= フィールドの三重定義

```
CreateEstimateItemInput  (primitive)      ← アプリ層 入力型
EstimateItemDescriptor   (VO)             ← Factory 入力型
EstimateItem.create()    (Entity params)  ← ドメイン
```

明細に1フィールド増えると3箇所を触る。これは規約①②を採用した代償であり、
Descriptor 固有の欠陥ではない。**「層の独立性」と「記述重複の少なさ」のトレードオフを
前者に倒している**ということ。中核集約（不変条件が多い）では妥当。単純な CRUD 集約で
やると過剰になる。

### 5. 反実仮想（腹落ち用の問い）

規約①を捨てて Factory が primitive を直接受け取れば Descriptor は消える。しかしその場合
Factory の入力が string/number だらけになり、「不正な文字列が来たら何を投げるか」という
**アプリ層の関心事をドメイン層が抱え込む**。Descriptor の存在は、その関心事をアプリ層に
留めるための対価。そう捉えると「いくつもある Descriptor」は冗長さではなく**境界の証**。

## 参考

- `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`
- `src/server/subdomains/estimate/application/commands/CreateEstimateCommand.ts`
- `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`（reconstitution 例外）
- `eslint.config.mjs` 58-75行（集約境界規約: no-restricted-imports）, 158-163行（Mapper 例外）
- Eric Evans『Domain-Driven Design』Factory の章
