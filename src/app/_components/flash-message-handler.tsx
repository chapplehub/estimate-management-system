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
};

function FlashMessageHandlerInner() {
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

export function FlashMessageHandler() {
  return (
    // NOTE: FlashMessageHandlerInnerでuseSearchParamsを使っているのでSuspenseで囲む必要がある。https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
    <Suspense fallback={null}>
      <FlashMessageHandlerInner />
    </Suspense>
  );
}
