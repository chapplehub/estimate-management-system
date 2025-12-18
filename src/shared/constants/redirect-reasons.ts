/**
 * リダイレクト理由コード
 * proxy.tsでリダイレクト時に設定し、flash-message-handler.tsxで読み取る
 */
export const REDIRECT_REASON = {
  SESSION_EXPIRED: "session_expired",
} as const;

export type RedirectReason =
  (typeof REDIRECT_REASON)[keyof typeof REDIRECT_REASON];

// stringとして送られてくるurlパラメタのreasonのチェック
export function isRedirectReason(value: string): value is RedirectReason {
  return Object.values(REDIRECT_REASON).includes(value as RedirectReason);
}

/**
 * フラッシュメッセージの種類（Sonnerのトースト種類に対応）
 */
export const FLASH_MESSAGE_TYPE = {
  WARNING: "warning",
  ERROR: "error",
  INFO: "info",
  SUCCESS: "success",
} as const;

export type FlashMessageType =
  (typeof FLASH_MESSAGE_TYPE)[keyof typeof FLASH_MESSAGE_TYPE];

export type FlashMessage = {
  type: FlashMessageType;
  message: string;
};
