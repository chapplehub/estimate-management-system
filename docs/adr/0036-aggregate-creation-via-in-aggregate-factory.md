# ADR-0036: 集約外からの新規集約生成は集約内ドメインファクトリ経由で行う

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-06-06 |
| 最終更新日   | 2026-06-06 |

## コンテキスト

Issue #293 で初のアプリケーション層スライス `CreateEstimateCommand`（C1）を実装した。
コマンドは多階層集約 Estimate（ルート + 子 EstimateVariation + 孫 EstimateItem + 修理
詳細群 + 改訂明細詳細）を**新規生成**して永続化する。

ここで ADR-0027（集約境界をバレル + ESLint で構造的に強制する）との衝突が判明した。
ADR-0027 は子エンティティ（EstimateVariation / EstimateItem / RepairEstimateDetail /
AfterRepairEstimateDetail / RevisedEstimateItemDetail）の**集約外からの直接 import を
ESLint `no-restricted-imports` で禁止**している。アプリ層のコマンドは集約外であるため、
当初計画どおり `EstimateItem.create()` / `EstimateVariation.create()` をコマンド内で
直接呼ぶと ESLint エラーになる。

ADR-0027 の「影響 > リポジトリ実装時の例外経路」は、外部コードが子エンティティを構築
する必要が生じるケースを (a)/(b)/(c) の選択肢付きで先送りしていた:

- (a) 構築側を `entities/` 配下に置く（レイヤリング違反）
- (b) 内部用バレル + パス制限で限定的にアクセス許可
- (c) 集約ルートに静的ファクトリを用意し、外部はルートに丸投げ

このうち**再構築（reconstitution）**サブケースは ADR-0031（EstimateMapper 限定の
ESLint 単一ファイルオーバーライド）が解決済みである。しかし ADR-0031 が開けた穴は
「永続化からの集約復元」に限定されており、**アプリ層からの「新規集約生成（create）」は
別サブケース**として未解決のまま残っていた。本 ADR はこの create サブケースを扱う。

なお既存コマンド規約（customer / product）では「Input はプリミティブで受け取り、
command 内で値オブジェクトへ変換する」が確立している。

## 検討した選択肢

### A. 集約内ドメインファクトリ `EstimateFactory` をバレル公開する（採用）

```typescript
// domain/entities/EstimateFactory.ts（entities/ 配下 = 子 import 許可）
export class EstimateFactory {
  static create(input: EstimateFactoryInput): Estimate {
    // VO 記述子 → 子エンティティ → 集約ルート
    const variations = input.variations.map((v) => /* EstimateVariation.create */ ...);
    return Estimate.create({ ...input, variations, repairDetail, afterRepairDetail });
  }
}
// 入力は VO 止まりの記述子（子エンティティ型を露出しない）
export type EstimateItemDescriptor = { productId: ProductId; itemName: ItemName; /* ... */ };
```

```typescript
// domain/entities/index.ts — Estimate と並べて公開
export { Estimate } from "./Estimate";
export { EstimateFactory, type EstimateFactoryInput, /* descriptors */ } from "./EstimateFactory";
```

```typescript
// application/commands/CreateEstimateCommand.ts
// primitive → VO 変換のみ（子エンティティは import しない）
const estimate = EstimateFactory.create({ estimateNumber, /* VO 記述子群 */ });
```

「子エンティティの組み立て」という集約内責務を `EstimateFactory`（entities/ 配下）に
閉じ込め、コマンドへは**値オブジェクトで構成した記述子**を渡す。コマンドは
`primitive → VO` 変換まで（既存規約どおり）を担う。

### B. コマンドを ESLint 例外に追加する（不採用）

ADR-0031 と同型に、`CreateEstimateCommand.ts` 1 ファイルに限り
`no-restricted-imports` を off にし、コマンド内で子エンティティを直接 `create()` する。

最小工数だが、集約境界に**新たな穴を増やす**。ADR-0031 は「例外をディレクトリ全体に
広げず 1 ファイルに閉じ込め、穴の増殖を防ぐ」と明言しており、create のたびに例外を
足していくと穴が増殖して境界が形骸化する。

### C. `Estimate.create` 自体を拡張する（不採用）

集約ルート `Estimate.create` に、子の VO 記述子を直接受け取って内部で子を組み立てる
責務を追加する。

ファクトリを別に設けずに済むが、既に 21 テストが通る確定済みの `Estimate.create`
シグネチャ（`variations: EstimateVariation[]` を受ける）を変更することになり、影響が
大きい。また「集約ルートの責務（不変条件の表明・状態遷移）」と「生成時の組み立て
（記述子 → 子）」が混在する。

## 決定

集約外（アプリ層）からの**新規集約生成**は、集約内に置いたドメインファクトリ
（`EstimateFactory`）経由で行う。ファクトリの入力は**値オブジェクト止まりの記述子**とし、
子エンティティ型を一切露出しない。ファクトリはバレル `entities/index.ts` から集約ルートと
並べて公開する。`primitive → VO` 変換はアプリ層コマンドが既存規約どおり担当する。

## 根拠

### ADR-0031 の「穴を増殖させない」方針と整合する

ADR-0031 は再構築の例外を Mapper 1 ファイルに閉じ込め、穴の増殖を明確に戒めている。
create のたびに ESLint 例外（選択肢 B）を足すとこの方針に反する。ファクトリ方式なら
**ESLint 例外を一切増やさず**に集約外から生成できる。再構築（ADR-0031: 単一ファイル
例外）と新規生成（本 ADR: 集約内ファクトリ）で手段を分けるのは、両者の性質
（Prisma 行 → 子の復元 vs VO 記述子 → 子の組み立て）が異なるためである。

### 集約境界を一切崩さない

子エンティティの構築は `EstimateFactory`（entities/ 配下）でのみ行われ、ADR-0027 の
「子は集約内からのみ構築」を満たす。ファクトリの入出力は VO 記述子と集約ルート Estimate
のみで、子エンティティ型は外部に露出しない。よってバレルから公開しても境界規約を損なわ
ない（公開面に子の mutator が現れない）。

### 既存コマンド規約と対称性を保つ

`primitive → VO` 変換はアプリ層コマンドに残す（customer / product コマンドと同じ）。
ファクトリは「VO 記述子 → 子 → ルート」の組み立てだけを担う。変換責務をドメインに移す
（ファクトリにプリミティブを渡す）案も検討したが、既存コマンド群と非対称になり、変換
ロジックの所在が分散するため採らなかった。

### 責務の二重化を避ける

空見積不可・variationNumber 重複・estimateType とサブタイプ詳細の整合（ADR-0019 /
ADR-0029）は `Estimate.create()` が既に担保する。ファクトリはこれらを再検証せず、
組み立てに徹する。

### 不採用理由まとめ

- **B（コマンドを ESLint 例外に追加）**: ADR-0031 の「穴の増殖を防ぐ」方針に反し、
  create のたびに境界の穴が増える
- **C（`Estimate.create` 拡張）**: 確定済みルートのシグネチャ変更の影響が大きく、
  ルートの責務に「記述子 → 子の組み立て」が混入する

## 影響

### 多階層集約の「新規生成」経路の標準パターンとする

今後の多階層集約（Order / Invoice / 仕入見積 等）でアプリ層から新規生成する場合、本
パターン（集約内ファクトリ + VO 記述子 + バレル公開）を採用する。これにより ADR-0027 の
境界規約を維持したまま、ESLint 例外を増やさずに集約を生成できる。

### 集約の「外部生成口」整理

集約外コードが集約に触れる経路は、性質ごとに手段が分かれる:
- **新規生成（create）**: 集約内ファクトリ `XxxFactory`（本 ADR）
- **再構築（reconstitution）**: Mapper 限定の ESLint 単一ファイル例外（ADR-0031）
- **状態変更（mutate）**: 集約ルートの委譲メソッド（ADR-0027 / ADR-0028）

### バレルの公開対象

`entities/index.ts` は集約ルートに加えてファクトリも公開できる。ただし公開してよいのは
「入出力が VO 記述子と集約ルートのみで、子エンティティ型を露出しないもの」に限る。

### 関連

- ADR-0027（集約境界の強制・本 ADR の先送り元）
- ADR-0031（再構築側の例外経路・本 ADR と手段が異なる対の関係）
- ADR-0019 / ADR-0029（生成時の不変条件は集約ルートが担保）
- ADR-0026（採番した EstimateNumber を集約に渡して生成するフロー）
- `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`
- `src/server/subdomains/estimate/domain/entities/index.ts`
- `src/server/subdomains/estimate/application/commands/CreateEstimateCommand.ts`
