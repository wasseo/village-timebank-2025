// src/middleware.js
import { NextResponse } from "next/server";

/** 공개로 둘 경로 — 필요에 따라 추가 가능 */
const PUBLIC_PATHS = new Set([
  "/",          // 홈(공개)
  "/login",     // 로그인 페이지
  "/logout",    // 로그아웃(있다면)
]);

/** 정적 리소스(Next.js 내부 파일 등)는 항상 통과 */
function isAsset(pathname) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets")
  );
}

/** 세션 쿠키 확인: iron-session + (옵션) Supabase */
const IRON_COOKIE = process.env.IRON_SESSION_COOKIE_NAME || "tb_session";
function hasAnySession(req) {
  const c = req.cookies;

  // iron-session (로그인 성공 시 생성되는 쿠키)
  if (c.has(IRON_COOKIE)) return true;

  // Supabase(병행 사용 시)
  if (c.has("sb-access-token") && c.has("sb-refresh-token")) return true;

  return false;
}

export function middleware(req) {
  const { pathname, search } = req.nextUrl;

  // 정적 또는 공개 경로면 통과
  if (isAsset(pathname) || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // 보호하고 싶은 경로 정의
  const needsAuth = 
        pathname.startsWith("/me") || 
        pathname.startsWith("/earn") ||
        pathname.startsWith("/register") ;  
     
  // 인증 불필요한 경로면 통과
  if (!needsAuth) return NextResponse.next();

  // 세션 있으면 통과
  if (hasAnySession(req)) return NextResponse.next();

  // 세션 없으면 로그인 페이지로 리다이렉트 (+ next 파라미터 전달)
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname + (search || ""));
  return NextResponse.redirect(url);
}

/** 미들웨어 감시 대상 설정 */
export const config = {
  matcher: ["/:path*"],
};

