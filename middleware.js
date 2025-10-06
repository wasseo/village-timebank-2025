// middleware.js
import { NextResponse } from "next/server";

const PROTECTED = ["/me", "/profile", "/earn", "/scan"];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const cookieName = process.env.IRON_SESSION_COOKIE_NAME || "tb_session";
  const has = req.cookies.get(cookieName);

  // 보호 경로: 비로그인 → /login
  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    if (!has) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 로그인 상태에서 /login 접근 → /me
  if (pathname.startsWith("/login") && has) {
    return NextResponse.redirect(new URL("/me", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/me/:path*",
    "/profile/:path*",
    "/earn/:path*",
    "/scan/:path*",
    "/login/:path*",
  ],
};
