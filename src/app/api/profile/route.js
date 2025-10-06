// src/app/api/profile/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // iron-session은 edge 미지원

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔹 내 프로필 조회
export async function GET() {
  const session = await getIronSession(cookies(), sessionOptions);
  if (!session.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, name, organization, address, created_at")
    .eq("id", session.user.id)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, profile: data });
}

// 🔹 내 프로필 수정
export async function PUT(req) {
  const session = await getIronSession(cookies(), sessionOptions);
  if (!session.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  const address = String(body?.address ?? "").trim();
  const organization = String(body?.organization ?? "").trim();

  if (!name || !address) {
    return NextResponse.json({ ok: false, error: "이름과 주소는 필수입니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ name, address, organization })
    .eq("id", session.user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
