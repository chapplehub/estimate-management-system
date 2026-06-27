import { dateRangeValue } from "@server/shared/infrastructure/dateRange";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { Prisma } from "@generated/prisma/client";

/** $transaction のコールバックに渡るトランザクションクライアント。 */
export type Tx = Prisma.TransactionClient;

/**
 * insert の一意制約違反（Prisma P2002）を再試行可能な ConflictError へ翻訳する。
 *
 * 販売単価3層（共通・得意先別・納品先別）のリポジトリで共有する。アプリ層の存在チェックを
 * すり抜けた二重作成レースは親の PK 衝突として P2002 で表面化するため、層ごとの語彙で組んだ
 * メッセージを添えて ConflictError へ翻訳する。P2002 以外はそのまま rethrow する。
 */
export function translateInsertConflict(error: unknown, conflictMessage: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError(conflictMessage);
  }
  throw error;
}

/**
 * 親の version 条件付き UPDATE の影響行数を検査し、競合なら ConflictError を throw する。
 *
 * `WHERE キー AND version = expectedVersion` の updateMany が返した影響行数を渡す。`count === 0`
 * は version 不一致（先行更新）と行消失（削除済み）の両方を覆うため、後勝ちの変更喪失を防ぐ
 * 楽観ロックの競合として翻訳する（ADR-0039）。型付き updateMany 自体は各リポジトリに残し、
 * モデル固有の WHERE 句の型安全を保つ。
 */
export function assertVersionBumped(count: number): void {
  if (count === 0) {
    throw new ConflictError(
      "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
    );
  }
}

/**
 * 期間行テーブルの差異（テーブル名・id を除く一意キー列）をパラメータ化する設定。
 *
 * `table`・`keyColumns` はいずれも各リポジトリ内のコンパイル時定数のみを渡す前提で、
 * ユーザー入力を一切含まない。ゆえに識別子を `Prisma.raw` で SQL に埋め込んでも安全。
 */
export interface PeriodTableConfig {
  /** 期間行テーブル名（例: "customer_selling_price_periods"）。 */
  table: string;
  /** id を除く一意キー列名。順序は {@link PeriodWriteRow.keyValues} と対応する（例: ["customer_id", "product_id"]）。 */
  keyColumns: readonly string[];
  /** 金額（NUMERIC）の値列名（例: "selling_price" / "cost_price"）。コンパイル時定数のみ。 */
  valueColumn: string;
}

/** append-only で書き込む期間行1件分の値。 */
export interface PeriodWriteRow {
  id: string;
  /** {@link PeriodTableConfig.keyColumns} と同順の uuid 値。 */
  keyValues: readonly string[];
  /** {@link PeriodTableConfig.valueColumn} 列へ書き込む通貨スケール固定の10進文字列。 */
  value: string;
  start: string;
  end: string | null;
}

/**
 * 集約の全期間行を daterange 付きで append-only 挿入する（販売単価3層で共用）。
 *
 * 既存 id は `ON CONFLICT (id) DO NOTHING` で no-op にし、新規 id の行だけを挿入する。これにより
 * insert/update のどちらからも安全に呼べ、update では既存行の updated_at を一切動かさない（監査保持）。
 * `daterange` は Prisma typed では扱えないため `$executeRaw` で書き、半開区間 `[)` の生成は共有
 * フラグメント `dateRangeValue` に委ねる（ADR-0067）。
 *
 * 現状は行ごとのループ INSERT（N+1）。一括 INSERT への改善（別 Issue）はこのループを複数行 VALUES
 * へ差し替えるだけで済む。
 */
export async function appendPeriodRows(
  tx: Tx,
  config: PeriodTableConfig,
  rows: readonly PeriodWriteRow[]
): Promise<void> {
  const table = Prisma.raw(config.table);
  const columns = Prisma.raw(
    ["id", ...config.keyColumns, config.valueColumn, "applicable_period", "updated_at"].join(", ")
  );
  for (const row of rows) {
    const idAndKeys = Prisma.join([
      Prisma.sql`${row.id}::uuid`,
      ...row.keyValues.map((value) => Prisma.sql`${value}::uuid`),
    ]);
    await tx.$executeRaw`
      INSERT INTO ${table} (${columns})
      VALUES (
        ${idAndKeys},
        ${row.value}::numeric,
        ${dateRangeValue(row.start, row.end)},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

/**
 * 集約の期間行と DB を一致させる差分 sync（upsert＋集約から消えた行の削除）。
 *
 * append-only（{@link appendPeriodRows}）が追加しか表現できないのに対し、こちらは編集（in-place
 * 更新）・適用終了（終了日差し替え）・削除（行の消去）を伴う集約のために、DB を集約の現在状態へ
 * 収束させる（ADR-0032 の差分 upsert）。
 *
 * - **upsert**: 既存 id は `ON CONFLICT (id) DO UPDATE` で値（金額・適用期間）を更新する。ただし
 *   `WHERE 値が IS DISTINCT FROM` を付け、**変更が無い行は no-op** にして `updated_at` を据え置く
 *   （監査保持）。変更がある行だけ `updated_at` が前進する。
 * - **delete**: スコープキー（{@link scopeKeyValues}）配下で、集約に存在しない id の行を削除する。
 *   集約が空（全行削除）でも `scopeKeyValues` でスコープを特定できるよう、削除範囲のキーは行から
 *   導かず明示引数で受ける（空集約だと `rows` から導出できないため）。
 *
 * `daterange` は Prisma typed では扱えないため `$executeRaw`/`dateRangeValue` で書く（ADR-0067）。
 * version 競合の検査は呼び出し側の条件付き updateMany が担う（ADR-0039）。
 *
 * @param scopeKeyValues 削除スコープを定める {@link PeriodTableConfig.keyColumns} と同順の uuid 値。
 */
export async function syncPeriodRows(
  tx: Tx,
  config: PeriodTableConfig,
  scopeKeyValues: readonly string[],
  rows: readonly PeriodWriteRow[]
): Promise<void> {
  const table = Prisma.raw(config.table);
  const valueColumn = Prisma.raw(config.valueColumn);
  const columns = Prisma.raw(
    ["id", ...config.keyColumns, config.valueColumn, "applicable_period", "updated_at"].join(", ")
  );

  for (const row of rows) {
    const idAndKeys = Prisma.join([
      Prisma.sql`${row.id}::uuid`,
      ...row.keyValues.map((value) => Prisma.sql`${value}::uuid`),
    ]);
    await tx.$executeRaw`
      INSERT INTO ${table} (${columns})
      VALUES (
        ${idAndKeys},
        ${row.value}::numeric,
        ${dateRangeValue(row.start, row.end)},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        ${valueColumn} = EXCLUDED.${valueColumn},
        applicable_period = EXCLUDED.applicable_period,
        updated_at = CURRENT_TIMESTAMP
      WHERE ${table}.${valueColumn} IS DISTINCT FROM EXCLUDED.${valueColumn}
         OR ${table}.applicable_period IS DISTINCT FROM EXCLUDED.applicable_period
    `;
  }

  // 集約に存在しない id の行を削除する。空配列なら ANY(空) が常に偽となり、スコープ配下の全行が
  // 削除対象になる（全行削除のケースも同一経路で扱える）。
  const keyPredicate = Prisma.join(
    config.keyColumns.map((col, i) => Prisma.sql`${Prisma.raw(col)} = ${scopeKeyValues[i]}::uuid`),
    " AND "
  );
  const survivingIds = rows.map((row) => row.id);
  await tx.$executeRaw`
    DELETE FROM ${table}
    WHERE ${keyPredicate}
      AND NOT (id = ANY(${survivingIds}::uuid[]))
  `;
}
