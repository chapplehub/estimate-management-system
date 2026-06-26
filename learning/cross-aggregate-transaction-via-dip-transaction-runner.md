# 集約またぎトランザクションを DIP で綺麗に張る — TransactionRunner ポートの配置と Prisma 漏れ防止

作成日: 2026-06-26

## 概要

複数集約にまたがる原子的書き込み（cross-aggregate transaction）を、DDD のレイヤリング（Domain/App は Prisma を import しない）を一切壊さずに実現する構造。issue #440（申請 submit の bump+insert 原子化・ADR-0069）の実装方式を詰める中で整理した。

要点：
- **トランザクション境界の demarcation がアプリ層へ上がること自体は、レイヤリング違反ではない**。違反になるのは「具体 `prisma` に触れる」「`Prisma.TransactionClient` 型を repo インターフェースに漏らす」という*手段*だけ。
- 回避策は **DIP**。`TransactionRunner` ポートを高位層（アプリ層）が所有し、infra アダプタがそれを実装する。
- ポートのシグネチャを **Prisma 型ゼロの thunk `run<T>(work)`** にするのが漏れ防止の肝。

## 詳細

### 単一集約ではトランザクションは完全に隠蔽できた

DDD の根本：**集約＝トランザクション境界（整合性境界）**。1回で原子的に守るべき範囲が1集約に収まるので、repo メソッドが自前で `prisma.$transaction` を開けば tx は repo の中で生まれて死ぬ。アプリ層は「トランザクションが存在することすら知らない」。これが理想形（tx はインフラの隠蔽された詳細）。

```
アプリ層:   command → estimateRepo.update(estimate, v)      ← ただのメソッド呼び出し
インフラ層: update() { prisma.$transaction(tx => { ...子・孫まで全部... }) }  ← tx はここで完結
```

### cross-aggregate で境界が1メソッドに収まらなくなる

原子単位が「bump（estimate 集約）＋ insert（application 集約）」の2つの repo 呼び出しにまたがると、境界は1 repo メソッドに収まらない。両書き込みを協調させているユースケース（アプリ層）が境界を demarcate せざるを得ない。「何が原子的か」を知るのはユースケースだけだから。

### 2つの問題は別物（混同しない）

1. **demarcation の手段＝レイヤリング問題**：境界がアプリ層へ上がるのは正しい。だが
   - ✗ アプリ層が `prisma.$transaction(...)` を直接書く → 具体 prisma（インフラ）import で違反
   - ✗ repo メソッドに `tx: Prisma.TransactionClient` 引数を生やす → ドメインの repo IF に Prisma 型が漏れて違反
   - ✓ 注入された **`TransactionRunner` 抽象**で `txRunner.run(() => {...})` と境界だけ宣言
2. **自前 $transaction の合成＝純技術問題（ACID）**：`update()` と `insert()` がそれぞれ独立に `$transaction` を開くと独立した2コミットになり、1原子単位に束ねられない。Prisma のインタラクティブ tx は素直にネストできないので、内側を「**周囲に tx があれば相乗り、無ければ自分で開く**」形へ開く改修が要る。これはレイヤリングと**直交**（どの方式でも必須）。

### DIP の正確な形

DIP は「arrow を app→infra から infra→app へ単純逆転」ではない。「**高位層が所有する抽象に、高位も低位も依存する。具象（infra）のソース依存がその抽象へ向く**」。

```
実行時の制御フロー:  app が runner を呼び、runner が prisma を走らせる   … app → infra
ソース依存の向き:    infra の PrismaTransactionRunner が app 側の        … infra → app（逆転）
                     TransactionRunner インターフェースを import
```

肝：infra が依存するのは「app が所有する*抽象*」であって app の*具象*ではない。app も同じ抽象に依存し、infra の具象には決して依存しない。

### ポートはドメインでなくアプリ層に置く（repo インターフェースと対照的）

このコードベースは repo ポートを**ドメイン層**（`domain/repositories/`）に置く。だが `TransactionRunner` は**ドメインに置かない**。

理由：**トランザクションはドメイン概念ではない**。ドメインは「トランザクションが存在すること自体を知ってはならない」純粋な層。これは ADR-0039 が version について述べた論法（「version は業務概念ではなく永続化の並行制御メタデータゆえドメインモデルに載せない」）と同型。トランザクション境界は**ユースケースのオーケストレーション関心**。

→ **決定：ポートは `shared/application`（新設）に置く**。横断（全サブドメインが使う）ゆえサブドメイン配下でなく shared。実装は `shared/infrastructure`。

CLAUDE.md は「infra は*ドメイン*インターフェースを実装」と書くが、ここでは infra が*アプリ層*のポートを実装する。クリーンアーキの依存方向（外側 infra → 内側 app/domain）に沿うので正当だが、「ポートは全部ドメイン」という既存慣習からの**意図的な逸脱**であり、理由（トランザクションは非ドメイン概念）を記録する価値がある。

### 構造スケッチ

```
src/server/shared/application/.../TransactionRunner.ts   ← ポート（抽象・app 所有）
  export interface TransactionRunner {
    run<T>(work: () => Promise<T>): Promise<T>   // ★ Prisma 型ゼロの thunk
  }

src/server/shared/infrastructure/.../PrismaTransactionRunner.ts  ← アダプタ（infra→app に依存）
  import prisma from "@server/prisma"
  class PrismaTransactionRunner implements TransactionRunner {
    run(work) { return prisma.$transaction(tx => txStore.run(tx, work)) }  // ALS に tx を seed
  }

command (app):
  constructor(private txRunner: TransactionRunner, ...repos)
  execute() { ... await this.txRunner.run(async () => {
    await estimateRepo.update(...); await appRepo.insert(...);
  }) }

repos (infra) 内部:
  const client = currentClient()   // ALS の tx か、無ければ global prisma — infra 内に閉じる
```

漏れ防止の決め手：**ポートを Prisma 型ゼロの thunk `run<T>(work)` にする**。`tx` 引数も `Prisma.TransactionClient` も登場させない。実際の tx 型は infra（アダプタ＋AsyncLocalStorage ストア＋`currentClient()`）の中にだけ棲む。demarcation（問題1）も ambient 相乗り（問題2）も両方インフラに封じ込まる。

## 参考

- issue #440（申請 submit の bump〜insert 間 TOCTOU 窓）
- ADR-0069（bump+insert を単一トランザクションで原子化）
- ADR-0039（集約ルート version 楽観ロック・version は非業務概念ゆえドメインに載せない＝本件のポート配置と同型論法）
- ADR-0032（差分 upsert＝update が自前 $transaction を張る永続化方式）
- CLAUDE.md「Critical: DDD Layering Rules」
- `src/server/subdomains/estimate/application/commands/SubmitApplicationCommand.ts`
- `src/server/prisma.ts`（global シングルトン）
- `learning/aggregate-boundary-minimal-consistency-for-transient-invariant.md`
