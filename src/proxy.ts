import { getCurrentSession } from "@server/shared/auth";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { NextRequest, NextResponse } from "next/server";

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
