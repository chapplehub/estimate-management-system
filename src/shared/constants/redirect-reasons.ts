/**
 * リダイレクト理由コード
 * proxy.tsでリダイレクト時に設定し、flash-message-handler.tsxで読み取る
 */
export const REDIRECT_REASON = {
  SESSION_EXPIRED: "session_expired",
  FORBIDDEN: "forbidden",
  EMPLOYEE_CREATED: "employee_created",
  EMPLOYEE_UPDATED: "employee_updated",
  EMPLOYEE_DELETED: "employee_deleted",
  DEPARTMENT_CREATED: "department_created",
  DEPARTMENT_UPDATED: "department_updated",
  DEPARTMENT_DELETED: "department_deleted",
  ROLE_CREATED: "role_created",
  ROLE_UPDATED: "role_updated",
  ROLE_DELETED: "role_deleted",
  PRODUCT_CREATED: "product_created",
  PRODUCT_UPDATED: "product_updated",
  PRODUCT_DELETED: "product_deleted",
  PRODUCT_ACTIVATED: "product_activated",
  PRODUCT_DEACTIVATED: "product_deactivated",
  CUSTOMER_CREATED: "customer_created",
  CUSTOMER_UPDATED: "customer_updated",
  CUSTOMER_DELETED: "customer_deleted",
  CUSTOMER_ACTIVATED: "customer_activated",
  CUSTOMER_DEACTIVATED: "customer_deactivated",
  DELIVERY_LOCATION_CREATED: "delivery_location_created",
  DELIVERY_LOCATION_UPDATED: "delivery_location_updated",
  DELIVERY_LOCATION_DELETED: "delivery_location_deleted",
  DELIVERY_LOCATION_ACTIVATED: "delivery_location_activated",
  DELIVERY_LOCATION_DEACTIVATED: "delivery_location_deactivated",
  ESTIMATE_CREATED: "estimate_created",
  ESTIMATE_UPDATED: "estimate_updated",
  ESTIMATE_DUPLICATED: "estimate_duplicated",
  ESTIMATE_REVISED: "estimate_revised",
} as const;

export type RedirectReason = (typeof REDIRECT_REASON)[keyof typeof REDIRECT_REASON];

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

export type FlashMessageType = (typeof FLASH_MESSAGE_TYPE)[keyof typeof FLASH_MESSAGE_TYPE];

export type FlashMessage = {
  type: FlashMessageType;
  message: string;
};
