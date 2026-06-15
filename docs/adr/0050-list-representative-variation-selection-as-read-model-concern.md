# ADR-0050: 見積一覧の代表バリエーションを「ACTIVE 優先の最小 → 全体の最小」で選び、read model に閉じる

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-15 |
| 最終更新日 | 2026-06-15 |

## コンテキスト

見積一覧（#344）の read model を設計するにあたり、一覧の 1 行をどの単位にするか、行に出す金額・状態をどのバリエーションから取るかを決める必要がある。

1 見積（Estimate）は複数の EstimateVariation を持ち、各バリエーションが独自の集計金額（finalTotal 等）とバリエーション状態（ACTIVE/INACTIVE）を持つ。一覧で見積を 1 行に集約するには、代表となる単一バリエーションを選ぶ規則が要る。

当初 #344 は「代表 = `variationNumber = 1`（基準バリエーション）。必ず存在し決定的」を前提としていたが、ドメイン層の調査で次が判明した:

- バリエーションに**物理削除のユースケースは無い**（`removeVariation` はドメインに存在するがどのコマンドからも未配線）。作成・複製時は 1 から採番されるため `variationNumber=1` は事実上常に存在する。
- ただし**無効化（deactivate）は可能**で、「最低 1 つ ACTIVE」を強制する不変条件は無い。**全バリエーションが INACTIVE の見積は正規の状態**（システム設計書 §1.3・§3.3）。
- したがって「ACTIVE のうち 1 番」のような素朴な規則は、全 INACTIVE 見積で代表を選べず破綻する。

## 検討した選択肢

### A. `variationNumber = 1` 固定（不採用）

#344 当初案。`where: { variationNumber: 1 }` で引く。

問題: ACTIVE/INACTIVE を無視するため、無効化された 1 番を代表にしてしまう。利用者の関心は「今有効な見積額」であり表示意図に合わない。「賢い選択」への将来差し替えもしづらい。

### B. ACTIVE 優先の最小 `variationNumber` → 無ければ全体の最小（採用）

2 段階フォールバック:

1. ACTIVE のうち最小 `variationNumber`
2. ACTIVE が 1 件も無ければ全体の最小 `variationNumber`

「最低 1 バリエーション」の不変条件により常に存在し、決定的。全 INACTIVE 見積でも代表が定まり、その `activeStatus` は正直に INACTIVE を返す。

### C. SQL の `DISTINCT ON` / ウィンドウ関数（不採用）

宣言的に 1 クエリで選べるが Prisma 型が外れ、テスト・保守が重い。バリエーション数は 1 見積あたり僅少なので不要。

## 決定

選択肢 B を採用する。代表選択は **CQRS read model（infra 層の `PrismaEstimateQueryService`）に閉じ**、各見積のバリエーションを軽量列（`variationNumber` / `status` / `finalTotal`）だけ `include` し、mapper で `find(ACTIVE) ?? [0]`（`variationNumber` 昇順）で選ぶ。一覧の粒度は **Estimate 単位**（バリエーション単位ではない）。

## 根拠

- **read 専用の関心事**: 「一覧で見積を代表させる」は表示の都合であり、集約の構造不変条件ではない。ドメインに持ち込まず infra の read model に閉じるのが CQRS に整合（ADR-0013 と同じ思想）。賢い選択規則を将来差し替えても write 側に影響しない。
- **常に存在し決定的**: 「最低 1 バリエーション」に支えられ null 落ちしない。`variationNumber=1` 固定（選択肢 A）は表示意図（今有効な額）に合わず、ACTIVE を無視する。
- **全 INACTIVE を正直に扱う**: フォールバックで代表が定まり、`activeStatus` が INACTIVE を返す。一覧で「全無効の見積」も識別できる。
- **実装の単純さ**: 昇順配列に対し `find(ACTIVE) ?? [0]` の 1 行でフォールバックを表現でき、選択肢 C のような SQL 機構は不要。

## 影響

- 一覧 DTO（`EstimateSummaryDTO`）の `finalTotal`・`activeStatus` は代表バリエーション由来。フロントはこの契約に依存する。
- 代表選択規則の「賢い選択」拡張（例: 申請中バリエーション優先など）は将来 issue で infra 内を差し替えれば済み、DTO 契約・ドメインは不変。
- `finalTotal`・`activeStatus` は代表（別テーブル/導出）由来のため、一覧の `orderBy` で直接ソートできない。ソート可能フィールドは Estimate 自身の列（`estimateNumber` / `estimateDate` / `deadline` / `createdAt`）に限る。
- 用語「代表バリエーション」は CONTEXT.md に定義（基準バリエーション＝`variationNumber=1` 固定とは区別）。
