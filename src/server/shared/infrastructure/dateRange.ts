import { Prisma } from "@generated/prisma/client";

/**
 * 適用期間（PostgreSQL `daterange` 列）の読み書きを担う共有 SQL フラグメント。
 *
 * `daterange` は Prisma typed では扱えず `$queryRaw`/`$executeRaw` で読み書きするが（ADR-0067）、
 * 半開区間 `[開始, 終了)` の不変条件と境界展開を各リポジトリに散らすと取り違えやすい。値生成
 * （書き込み）と境界 projection（読み出し）をここへ集約し、pricing の3層（共通・得意先別・
 * 納品先別販売単価）で共用する（rule of three）。期間行テーブルは適用期間列を一律
 * `applicable_period` という列名で持つ前提。
 */

/**
 * 適用期間行の書き込み用 `daterange` 値を生成するフラグメント。
 *
 * 終了は無期限なら `null` を渡し、上端 unbounded の半開区間 `[start, ∞)` になる。
 * 番兵日付は使わない（ADR-0067）。`'[)'` の半開区間指定がこのフラグメントの肝。
 */
export function dateRangeValue(start: string, end: string | null): Prisma.Sql {
  return Prisma.sql`daterange(${start}::date, ${end}::date, '[)')`;
}

/**
 * 適用期間（`applicable_period` 列）の下端・上端を text へ展開する SELECT projection。
 *
 * `daterange` の合成文字列をパースせず `lower()`/`upper()` で別カラムに割り、上端は無期限なら
 * `NULL` のまま返す。エイリアス（`start` / `"end"`）は Mapper の Row 型に対応する。
 */
export const applicablePeriodBounds: Prisma.Sql = Prisma.sql`lower(applicable_period)::text AS start, upper(applicable_period)::text AS "end"`;
