// src/app/api/profile/route.js
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";               // 세션 설정 (이미 만들어둔 파일)
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";  // ⚠️ 꼭 필요 (iron-session은 edge 미지원)

// 서버 전용 Supabase 클라이언트 (service role key 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 내 프로필 조회
export async function GET(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, name, org, created_at")
    .eq("id", session.user.id)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: res.headers });
  }

  return NextResponse.json({ ok: true, profile: data }, { headers: res.headers });
}

// 내 프로필 수정
export async function PUT(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }


  
  const body = await req.json();
  const name  = String(body?.name ?? "").trim();
  const org   = String(body?.org  ?? "").trim();
  const phone = String(body?.phone ?? "").trim().replace(/\D/g, ""); // 숫자만

  const { error } = await supabase
    .from("profiles")
    .update({ name, org, phone })
    .eq("id", session.user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: res.headers });
  }

  return NextResponse.json({ ok: true }, { headers: res.headers });
}
