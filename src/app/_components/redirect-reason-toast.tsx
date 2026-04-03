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
};

function RedirectReasonToastInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason && isRedirectReason(reason)) {
      const { type, message } = FLASH_MESSAGES[reason];
      // ブラケット記法でtoastオブジェクトを利用
      toast[type](message);

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
