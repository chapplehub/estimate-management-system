/**
 * 共有DB単体テストのコード割当ファクトリ（#608 / ADR 20260715-f71）。
 *
 * DB依存の単体テスト（vitest）は `.env.unit` の**単一の共有DB**上でファイルを別ワーカーで
 * 並列実行する（ADR-0012）。2ファイルが同じユニークコード（`roleCd` 等）を使うと、互いの
 * `beforeEach`/`afterEach` cleanup が相手の行を削除し合い、確率的（flaky）に落ちる。
 *
 * その隔離の不変条件は「**1コード = 高々1所有テストファイル**」である。この不変条件を、
 * コード空間（ユニークカラム）ごとに**コードをキーにした `as const` 宣言**へ集約して守る：
 *
 * ```ts
 * export const roleTestCodes = defineTestCodes(/^ROLE9\d{2}$/, {
 *   ROLE971: { owner: "employee.roleNames", use: "assignedRole" },
 *   ROLE972: { owner: "employee.roleNames", use: "seniorRole" },
 * });
 * ```
 *
 * 同じコードを二度割り当てるとオブジェクトリテラルの重複キー＝**TS1117** でコンパイル時に
 * 弾かれる（pre-push `tsc`・エディタ）。この関数は TS1117 が捕えない不変条件——形式（帯外流出・
 * seed 帯侵入）／同一所有者内の用途キー重複／予約語——を import 時に一度だけ機械検証し、
 * 消費側が引く派生索引 `owner → { [use]: code, codes: string[] }` を構築する。
 *
 * `codes` は当該所有者の全コード配列で、**生成用（用途別コード）と cleanup 用（全コード）を
 * 同一ソースから導出**する。別々に導出すると片方だけ増えて drift → 削除漏れ → 同型の再発を招く。
 */

/** コード1つの宣言。`owner` は所有テストファイル（論理名）、`use` はファイル内の用途。 */
type CodeEntry = { readonly owner: string; readonly use: string };

/** `defineTestCodes` に渡すコードキーの宣言マップ。 */
type CodeMap = Record<string, CodeEntry>;

/** 宣言マップに現れる所有者名の union。 */
type Owners<M extends CodeMap> = M[keyof M]["owner"];

/**
 * ある所有者 `O` の派生エントリ型。用途キー → コード（リテラル）に加え、
 * 全コード配列 `codes` を持つ。用途キーとコードの対応は宣言マップから静的に導出される。
 */
type OwnerEntry<M extends CodeMap, O extends string> = {
  readonly [K in keyof M as M[K]["owner"] extends O ? M[K]["use"] : never]: K;
} & { readonly codes: readonly string[] };

/** 宣言マップ `M` から構築される派生索引型（所有者 → 用途別コード＋全コード配列）。 */
type DerivedIndex<M extends CodeMap> = {
  readonly [O in Owners<M>]: OwnerEntry<M, O>;
};

/** 構築途中の可変エントリ。用途キー(string)と `codes`(string[]) を同居させる内部型。 */
interface MutableOwnerEntry {
  codes: string[];
  [use: string]: string | string[];
}

/**
 * コードキーの宣言から派生索引を構築する。import 時に一度だけ実行される想定。
 *
 * @param pattern 全コードが合致すべき形式（例 `/^ROLE9\d{2}$/`）。テスト帯を絞ることで
 *   seed 済み正準マスタ帯（例 `ROLE001-015`）との非衝突を構造的に保証する。
 * @param map コード文字列をキーにした `{ owner, use }` 宣言。同一コードの二重割当は TS1117。
 * @throws 形式違反・同一所有者内の用途キー重複・予約語 `codes` を用途に使った場合。
 */
export function defineTestCodes<const M extends CodeMap>(pattern: RegExp, map: M): DerivedIndex<M> {
  const index: Record<string, MutableOwnerEntry> = {};

  for (const code of Object.keys(map)) {
    if (!pattern.test(code)) {
      throw new Error(`テストコード "${code}" が形式 ${pattern} に合致しません（帯外流出）`);
    }

    const { owner, use } = map[code];
    if (use === "codes") {
      throw new Error(
        `用途キーに予約語 "codes" は使えません（コード ${code}）。派生索引の全コード配列と衝突します`
      );
    }

    const entry: MutableOwnerEntry = (index[owner] ??= { codes: [] });
    if (use in entry) {
      throw new Error(
        `所有者 "${owner}" で用途キー "${use}" が重複しています（コード ${code}）。用途キーは所有者内で一意にしてください`
      );
    }

    entry[use] = code;
    entry.codes.push(code);
  }

  return index as unknown as DerivedIndex<M>;
}
