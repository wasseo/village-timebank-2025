// src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";  // ⚠️ iron-session은 edge 미지원

type UserSession = { user?: { id: string; phone: string } };

export async function GET(req: Request) {
  const res = new NextResponse();
  const session = await getIronSession<UserSession>(req, res, sessionOptions);
  const user = session.user ?? null;

  // 기본값 (미로그인)
  let profileComplete = false;

  if (user?.id) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      // ⚠️ 클라이언트에 노출되면 안됨. 반드시 서버 환경변수로 설정하세요.
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      if (url && serviceKey) {
        const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

        // 필요한 최소 필드만 조회 (기준 필드는 프로젝트 정책대로 조정 가능: name/address/org 등)
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          // 로깅만 하고 profileComplete=false로 둠
          console.error("[/api/me] profiles select error:", error.message);
        }

        // ✅ 프로필 행이 없거나 필수 필드 비어있으면 미완료
        profileComplete = !!(profile && profile.name && String(profile.name).trim().length > 0);
      } else {
        // 환경변수 미설정 시 보수적으로 미완료 처리
        console.warn("[/api/me] Supabase env missing; profileComplete=false fallback");
        profileComplete = false;
      }
    } catch (e) {
      console.error("[/api/me] unexpected:", e);
      profileComplete = false; // 오류 시에도 보수적으로 미완료
    }
  }

  return NextResponse.json(
    { user, profileComplete },
    { headers: res.headers }
  );
}
