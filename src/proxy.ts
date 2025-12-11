import { auth } from "@server/shared/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
const publicRoutes = ["/signin", "/"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // TODO: セッションが無効だった場合、その旨のトーストを出したい。
  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
