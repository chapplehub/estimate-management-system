"use client";

import {
  FLASH_MESSAGE_TYPE,
  isRedirectReason,
  REDIRECT_REASON,
  type FlashMessage,
  type RedirectReason,
} from "@shared/constants/redirect-reasons";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

// TODO: メッセージが増えてきたら、定数ファイルとして別の場所に移す。
const FLASH_MESSAGES: Record<RedirectReason, FlashMessage> = {
  [REDIRECT_REASON.SESSION_EXPIRED]: {
    type: FLASH_MESSAGE_TYPE.WARNING,
    message: "セッションの有効期限が切れました。再度ログインしてください。",
  },
  [REDIRECT_REASON.FORBIDDEN]: {
    type: FLASH_MESSAGE_TYPE.ERROR,
    message: "この操作を行う権限がありません。",
  },
  [REDIRECT_REASON.EMPLOYEE_CREATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "従業員を登録しました。",
  },
  [REDIRECT_REASON.EMPLOYEE_UPDATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "従業員情報を更新しました。",
  },
  [REDIRECT_REASON.EMPLOYEE_DELETED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "従業員を削除しました。",
  },
  [REDIRECT_REASON.DEPARTMENT_CREATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "部署を登録しました。",
  },
  [REDIRECT_REASON.DEPARTMENT_UPDATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "部署情報を更新しました。",
  },
  [REDIRECT_REASON.DEPARTMENT_DELETED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "部署を削除しました。",
  },
  [REDIRECT_REASON.ROLE_CREATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "役割を登録しました。",
  },
  [REDIRECT_REASON.ROLE_UPDATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "役割情報を更新しました。",
  },
  [REDIRECT_REASON.ROLE_DELETED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "役割を削除しました。",
  },
  [REDIRECT_REASON.PRODUCT_CREATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "商品を登録しました。",
  },
  [REDIRECT_REASON.PRODUCT_CREATED_PRICE_UNSET]: {
    type: FLASH_MESSAGE_TYPE.INFO,
    message: "商品を登録しました。共通販売単価が未設定です。商品詳細から設定してください。",
    // 設定を促す誘導文のため読了時間を確保して長めに表示する（既定4秒→10秒・#487）。
    durationMs: 10000,
  },
  [REDIRECT_REASON.PRODUCT_UPDATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "商品情報を更新しました。",
  },
  [REDIRECT_REASON.PRODUCT_DELETED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "商品を削除しました。",
  },
  [REDIRECT_REASON.PRODUCT_ACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "商品を有効化しました。",
  },
  [REDIRECT_REASON.PRODUCT_DEACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "商品を無効化しました。",
  },
  [REDIRECT_REASON.CUSTOMER_CREATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "得意先を登録しました。",
  },
  [REDIRECT_REASON.CUSTOMER_UPDATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "得意先情報を更新しました。",
  },
  [REDIRECT_REASON.CUSTOMER_DELETED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "得意先を削除しました。",
  },
  [REDIRECT_REASON.CUSTOMER_ACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "得意先を有効化しました。",
  },
  [REDIRECT_REASON.CUSTOMER_DEACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "得意先を無効化しました。",
  },
  [REDIRECT_REASON.DELIVERY_LOCATION_CREATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "納品先を登録しました。",
  },
  [REDIRECT_REASON.DELIVERY_LOCATION_UPDATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "納品先情報を更新しました。",
  },
  [REDIRECT_REASON.DELIVERY_LOCATION_DELETED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "納品先を削除しました。",
  },
  [REDIRECT_REASON.DELIVERY_LOCATION_ACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "納品先を有効化しました。",
  },
  [REDIRECT_REASON.DELIVERY_LOCATION_DEACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "納品先を無効化しました。",
  },
  [REDIRECT_REASON.ESTIMATE_CREATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "見積を登録しました。",
  },
  [REDIRECT_REASON.ESTIMATE_UPDATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "見積を更新しました。",
  },
  [REDIRECT_REASON.ESTIMATE_DUPLICATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "見積を複製しました。複製先の見積単価は複製先の見積年月日・宛先で再解決されています。",
  },
  [REDIRECT_REASON.ESTIMATE_REVISED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "得意先改訂しました。",
  },
  [REDIRECT_REASON.ESTIMATE_VARIATION_ADDED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "バリエーションを追加しました。",
  },
  [REDIRECT_REASON.ESTIMATE_VARIATION_ACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "バリエーションを有効化しました。",
  },
  [REDIRECT_REASON.ESTIMATE_VARIATION_DEACTIVATED]: {
    type: FLASH_MESSAGE_TYPE.SUCCESS,
    message: "バリエーションを無効化しました。",
  },
};

function RedirectReasonToastInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason && isRedirectReason(reason)) {
      const { type, message, durationMs } = FLASH_MESSAGES[reason];
      // ブラケット記法でtoastオブジェクトを利用
      toast[type](message, durationMs ? { duration: durationMs } : undefined);

      // URLからreasonパラメータを削除
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("reason");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}

export function RedirectReasonToast() {
  return (
    // NOTE: RedirectReasonToastInnerでuseSearchParamsを使っているのでSuspenseで囲む必要がある。https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
    <Suspense fallback={null}>
      <RedirectReasonToastInner />
    </Suspense>
  );
}
