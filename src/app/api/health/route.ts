/**
 * ヘルスチェックエンドポイント（Issue #758）
 *
 * compose の healthcheck / ロードバランサー向けの死活監視用。
 * DB 接続チェックは含めない（プロセスの生存確認のみ。
 * DB 断で app コンテナが再起動ループに入るのを避けるため）。
 */
export function GET(): Response {
  return Response.json({ status: "ok" });
}
