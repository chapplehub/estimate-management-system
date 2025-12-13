/**
 * クライアントサイド認証ファサード
 *
 * better-authのクライアントSDKをラップし、実装詳細を隠蔽する。
 * 認証技術の変更時はこのファイルのみを修正すれば良い。
 *
 * @see learning/auth-responsibilities-and-changeability.md
 */
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

/**
 * セッション情報を取得するReact Hook
 *
 * Client Componentで使用する。
 * Server ComponentではgetCurrentSession()を使用すること。
 *
 * @returns { data: session, isPending, error, refetch }
 */
export const useSession = authClient.useSession;
