// src/app/api/me/summary/route.js
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // 캐시 방지(개발 편의)
export const runtime = "nodejs";  // ⚠️ 꼭 필요 (iron-session은 edge 미지원)

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function GET(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await admin
    .from("v_user_me_summary")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const zero = { total_points: 0, earn_points: 0, redeem_points: 0, environment: 0, social: 0, economic: 0, mental: 0 };
  return NextResponse.json({ ok: true, summary: data ?? { user_id: session.user.id, ...zero } });
}
