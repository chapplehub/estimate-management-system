/**
 * PostgreSQL `LIKE`/`ILIKE` パターンのメタ文字エスケープを担う共有 SQL ヘルパ（#518）。
 *
 * Prisma typed の `contains:` は値を自動エスケープするが、`daterange @>` の都合で `$queryRaw` +
 * 生 ILIKE を使う一覧検索（pricing の原価/共通売価）ではユーザー入力の `%` `_` がパターンとして
 * 解釈され、意図しない広範囲がヒットする。`escapeLikePattern` で `\` `%` `_` を `\` でエスケープし、
 * 呼び出し側の ILIKE 句に `ESCAPE '\'` を付けてリテラル一致を保証する。
 */

/**
 * `LIKE`/`ILIKE` のメタ文字 `\` `%` `_` を `\` でエスケープする。
 *
 * 単一の正規表現1パス置換で各マッチを独立処理し、`\` を先に処理しないと二重エスケープになる
 * 順序依存を原理的に回避する。`$queryRaw` はパターンをバインドパラメータとして渡すため、
 * SQL文字列リテラルのエスケープは絡まず、純粋にパターン文字列としての3文字だけを扱えばよい。
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * 部分一致（contains）用の `LIKE`/`ILIKE` パターンを組み立てる。
 *
 * `escapeLikePattern` でメタ文字をリテラル化した本体を前後 `%` で囲む。呼び出し側の ILIKE 句には
 * `ESCAPE '\'` を付ける前提。囲みをここへ集約することで、呼び出し側での `%...%` 文字列連結（囲み
 * 忘れ・片側 `%` 等の別バグ）を防ぐ。他サブドメインが Prisma の `contains:` で表す部分一致検索と
 * 語彙を揃える。
 */
export function containsPattern(value: string): string {
  return `%${escapeLikePattern(value)}%`;
}
