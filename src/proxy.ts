import { getCurrentSession } from "@server/shared/auth";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { NextRequest, NextResponse } from "next/server";

/**
 * 未認証アクセスの前捌き
 *
 * 認証・認可の正本は各実行境界（page / Server Action）にある。ここは
 * 未認証セッションを早期に弾いてサインインへ誘導する UX 上の前捌きであり、
 * 唯一の防壁ではない。Server Action は matcher の next-action 除外（#25）で
 * ここを通らないため、認可をここに置いても網羅できない。
 *
 * 認可（管理者判定）はページ本体の verifyAdmin() が担う。
 */
const publicRoutes = ["/signin", "/"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  // LEARN: better-auth-proxy-session-validation
  const session = await getCurrentSession();

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(
      new URL(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`, request.url)
    );
  }

  return NextResponse.next();
}
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|.*\\.png$).*)",
      // NOTE: https://github.com/chapplehub/estimate-management-system/issues/25
      missing: [{ type: "header", key: "next-action" }],
    },
  ],
};
