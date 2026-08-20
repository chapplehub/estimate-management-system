# 「正しさの表現をどの層に置くか」のトリレンマ — 期間データの物理表現設計

作成日: 2026-06-23

## 概要

「適用期間」のような区間データをどう永続化するか設計する際、次の3つの望ましい性質は**同時には満たせず、2つしか取れない**という構造的トレードオフがある、という学び。共通販売単価集約（#426）のスキーマ設計議論で発見した。

3つの性質:

- **NULL レス**: テーブルから NULL を排除する（kawasima デシジョンツリー方針）
- **番兵レス**: `9999-12-31` のような番兵マジック値を使わない
- **ORM 型安全**: Prisma の typed Client（create/update/upsert/findFirst）で読み書きでき、生 SQL（`$queryRaw`）を要しない

「無期限（上端 unbounded）をどう表すか」が3者を引き裂く軸になる。

## 詳細

### 3案とトレードオフ

| 案 | 物理表現 | NULL レス | 番兵レス | ORM 型安全 |
|---|---|---|---|---|
| **A. 範囲型カラム1列** | `applicable_period daterange` ＋ `EXCLUDE USING gist (... WITH &&)` | ✅ | ✅ | ❌ Prisma が `Unsupported` 扱い → `$queryRaw` 必須 |
| **B. 2列＋to を nullable** | `from date NOT NULL`, `to date NULL`（NULL=無期限） | ❌ NULL で無期限を表す | ✅ | ✅ |
| **C. 2列＋番兵 NOT NULL** | `from date`, `to date NOT NULL`（無期限=`9999-12-31`） | ✅ | ❌ 番兵マジック値 | ✅ |

- A は「unbounded を範囲型の開端 `[2025-07-01,)` でネイティブ表現」できるため NULL も番兵も要らない。代償に Prisma の型安全を失う。
- B は ORM 型安全を保つが、上端 unbounded を `to = NULL` で表すので「unbounded は NULL ではない」という方針に反する。
- C は ORM 型安全を保ち NULL も消すが、`9999-12-31` という番兵がドメインにまで漏れうる。

### 核心的な気づき

1. **重複禁止（EXCLUDE 制約）は A・B・C のどれでも得られる。** B・C のような2列構成でも、式 GiST `EXCLUDE USING gist (product_id WITH =, daterange(from, to, '[)') WITH &&)` で「商品ごとに区間重複ゼロ」を DB レベルに張れる。つまり EXCLUDE は範囲型カラムの専売特許ではない。
   → **範囲型カラム(A)固有の価値は「重複禁止」ではなく「NULL レスと番兵レスの同時達成」だけに絞られる。**

2. **ドメイン層の複雑性はどの案でもほぼ同じ。** `ApplicablePeriod` VO（`contains(date)`: `from <= t < to`、`overlaps(other)`）は DB の物理表現と独立に必要。範囲型を選んでもドメインの判定ロジックは消えない。範囲型の唯一のドメイン的利点は「番兵マジック値がドメインに漏れない」こと。

3. **複雑性は消えず、層を移動するだけ（複雑性の保存則）。** A は「正しさを DB の型システムに寄せる」設計で、その分 Mapper/Repository の範囲型パース・`daterange()` 生成・差分 upsert/楽観ロックの `$queryRaw` 手書きとしてインフラ層の複雑性が増える。総量はむしろ増えることすらある。範囲型を選ぶ理由は「複雑性削減」ではなく「DB 物理保証＋NULL レス＋番兵レス」。

### #426 での決定

A（範囲型カラム ＋ EXCLUDE USING gist ＋ `$queryRaw`）を採用。理由:

- `$queryRaw` の被害は範囲型を持つこのテーブル群に局所化でき、読み書きパターンが単純（期間行 upsert／見積年月日での contains 取得）で動的クエリが少ない。
- 後続フェーズ A2（得意先別・納品先別販売単価）も同じ範囲型＋EXCLUDE を再利用でき、`$queryRaw` のパーサ/ジェネレータを1度書けば3レイヤーで償却できる。
- NULL レス・番兵レスの両立はプロジェクトのスキーマ方針の核心で、それを構造的に満たせるのは A だけ。範囲型パーサ・`daterange` 生成を infra の小ヘルパに隔離すれば Mapper 本体は汚れない。

### `$queryRaw` 採用のデメリット（A の代償・記録）

- 型安全の喪失（このテーブルだけ「Prisma を使っているのに型安全でない島」になる）
- 差分 upsert（ADR-0032）＋楽観ロック（ADR-0039）を生 SQL で手書きし、影響行数から `ConflictError` 判定も自前
- 範囲型文字列 `"[2025-07-01,)"` のパーサ自作（境界記号・上端/下端 unbounded・empty range のエッジケース）
- typed Repository に混じる生 SQL の島（読み手が2流儀を行き来）
- `prisma migrate` の shadow DB でのドリフト扱い・introspection 不全

## 一般化

「ある不変条件・正しさを、どの層の型システム/制約で表現するか」は常にトレードオフを含む。

- DB の制約・型（range, EXCLUDE）に寄せる → 物理保証は最強・表現は厳密だが、ORM の型安全や typed なクエリ表現を失う。
- ORM/アプリ層の型に寄せる → 開発体験（型安全・典型クエリの簡潔さ）は保てるが、「unbounded の表現」などを NULL や番兵で妥協するか、保証を実行時チェックに格下げする。

決め手は「複雑性の削減」ではなく「**どの正しさを物理保証したいか／どの妥協を許容できるか**」。複雑性は層を移動するだけで消えない、という前提で選ぶ。

## 参考

- 関連 Issue: #426（共通販売単価集約の実装）、#422（価格決定機構の輪郭）
- 関連 ADR: 0029（構造的不変条件 vs ユースケース制約）、0032（identity 保存差分 upsert）、0034（Null Object）、0039（集約ルート version 楽観ロック）、0064/0065（価格決定機構・原価移設）
- PostgreSQL: `daterange`/`tstzrange`、`EXCLUDE USING gist (... WITH &&)`、`btree_gist` 拡張（スカラー等値 `WITH =` を GiST に載せるため）
- メモリ: schema-null-elimination-preference（範囲型＋EXCLUDE を第一候補とする方針）、schema-table-decomposition-framework
