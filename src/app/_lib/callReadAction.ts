import { toast } from "sonner";
import { reportError } from "@/app/_lib/report-error";

/**
 * read/query 系 Server Action の失敗時にユーザーへ出す固定文言。
 *
 * 本番の Next.js はサーバー内部の例外メッセージ・スタックをクライアントへ送らず
 * `digest`（相関 ID）に置換するため、UI で示せるのは「取得に失敗した」までとなる。
 * 原因はサーバーログ側（`reportError` の digest 突き合わせ）で追う二層構造。
 */
export const READ_ACTION_FAILED_MESSAGE =
  "データの取得に失敗しました。時間をおいて再度お試しください。";

/**
 * 同一 ID の toast は sonner が 1 枚に統合する。`Promise.all` の並列呼び出しが
 * 一斉に失敗しても画面には 1 枚しか出さないための固定 ID。
 */
const READ_ACTION_FAILED_TOAST_ID = "read-action-failed";

/**
 * read/query 系 Server Action 呼び出しの共通ラッパー（ADR-20260723-h7r）。
 *
 * read/query 系 Action は業務エラーを持たず生データを直接返すため、失敗は常に
 * 非業務例外（DB 障害・ネットワーク断・想定外例外）の一種類しかない。
 * イベントハンドラ内の async 例外は App Router のエラー境界（`error.tsx`）が捕捉できず、
 * 裸 await のままでは未処理 Promise 拒否となり無言で失敗する。
 * そこで捕捉ロジックをこの 1 関数に集約し、失敗を `undefined` で呼び出し側へ返す。
 *
 * 失敗時の呼び出し側は「操作中断・state 凍結」（画面 state に一切触らない）とすること。
 * 失敗を業務上の空値（例: 税率 `null` = 税率未設定）へ変換して嘘の業務状態を見せてはならない。
 * `null` は業務値（税率未設定・商品の並行削除）として透過するため、sentinel は `undefined` を使う。
 *
 * @param action 呼び出す Server Action を実行するサンク
 * @param context 呼び出す Server Action の**関数名リテラル**（例: `"getProductSuggestions"`）。
 *   ログの文言をそのまま grep すれば Action 定義と全呼び出し箇所へ到達できるよう、動的組み立ては禁止
 * @returns 成功時は Action の戻り値、失敗時は `undefined`
 */
export async function callReadAction<T>(
  action: () => Promise<T>,
  context: string
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    // ログは catch のたびに全件記録し、ユーザー通知は固定 ID で 1 枚に畳む（非対称）。
    reportError(error, context);
    toast.error(READ_ACTION_FAILED_MESSAGE, { id: READ_ACTION_FAILED_TOAST_ID });
    return undefined;
  }
}
