/**
 * フォーム入力欄の共通 Tailwind クラス。
 *
 * `inputClass` は基本スタイル。`inputClassDisabled` は disabled 時に灰背景フィードバックを加える
 * バリアント（pending 中に入力欄を disable するフォーム向け）。EstimateHeaderForm は入力欄を
 * pending 中に disable するため `inputClassDisabled` を、バリ編集フォームのメモ textarea は
 * disable しないため `inputClass` を使う。両者の差（disabled スタイルの有無）は実挙動の差なので
 * 単一定数に統合せずバリアントとして保持する。
 */
export const inputClass =
  "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline";

export const inputClassDisabled = `${inputClass} disabled:bg-gray-100`;

/**
 * メモ textarea 共通クラス（明細メモセル・バリ単位メモ共用）。rows と aria-label は呼び出し側で付与する。
 * 数量・単価などの数値入力用（text-right 系）とは用途が異なるため統合しない。
 *
 * `block` 必須: textarea のデフォルト display は inline-block。明細テーブル（LineEditTable /
 * LineTable）は `whitespace-nowrap` 配下にあり、顧客メモ・社内メモの 2 つの textarea が改行されず
 * 横並びになってセル幅(w-72)を溢れ、操作列の削除ボタンにオーバーレイする（#368）。block で縦積みを保証する。
 */
export const memoInputClass =
  "mt-1 block w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400";

/**
 * 数値入力セル共通クラス（右寄せ）。明細テーブルの単価・掛率・数量などのセル内 input 用。
 * 幅（w-20/w-24/w-28 等）は列ごとに呼び出し側で付与する。LineTable（改訂先の価格調整）と
 * LineEditTable（C4 編集）の両テーブルで共用する。
 */
export const cellInputClass =
  "w-full border rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-400";
