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
 */
export const memoInputClass =
  "mt-1 w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400";
