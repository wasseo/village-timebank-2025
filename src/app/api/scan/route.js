// src/app/api/scan/route.js
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // ⚠️ 꼭 필요 (iron-session은 edge 미지원)

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const RECENT_DUP_SECONDS = 20;
const isDev = process.env.NODE_ENV !== "production";

export async function POST(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // b(booth_id) 또는 code 모두 허용
    let booth_id_param = (body?.b || body?.booth_id || "").trim();
    let code_param     = (body?.code || body?.c || "").trim();
    const client_event_id = body?.client_event_id ?? body?.e ?? null;

    /* ✅ [추가] code가 URL인 경우 /scan/<slug> 추출 */
    if (code_param && /^https?:\/\//i.test(code_param)) {
      try {
        const u = new URL(code_param);
        const m = u.pathname.match(/\/scan\/([A-Za-z0-9\-_.~]+)/);
        if (m?.[1]) code_param = m[1];
      } catch {
        // URL 파싱 실패시 무시
      }
    }

    if (!booth_id_param && !code_param) {
      return NextResponse.json(
        { ok: false, error: "booth_id(b) 또는 code 가 필요합니다." },
        { status: 400, headers: res.headers }
      );
    }

    // 1) 부스 조회
    let boothRow = null;
    if (booth_id_param) {
      const { data, error } = await admin
        .from("booths")
        .select("id, kind, amount, is_active")
        .eq("id", booth_id_param)
        .maybeSingle();
      if (error) throw error;
      boothRow = data;
    } else {
      const { data, error } = await admin
        .from("booths")
        .select("id, kind, amount, is_active")
        .eq("code", code_param)
        .maybeSingle();
      if (error) throw error;
      boothRow = data;
    }

    if (!boothRow) {
      return NextResponse.json(
        { ok: false, error: "부스를 찾을 수 없습니다." },
        { status: 404, headers: res.headers }
      );
    }

    if (typeof boothRow.is_active === "boolean" && !boothRow.is_active) {
      return NextResponse.json(
        { ok: false, error: "비활성화된 부스입니다." },
        { status: 403, headers: res.headers }
      );
    }

    const amount = Number(boothRow.amount || 0);
    const kind   = boothRow.kind === "redeem" ? "redeem" : "earn";

    // 2) 최근 중복 방지
    const sinceIso = new Date(Date.now() - RECENT_DUP_SECONDS * 1000).toISOString();
    const { data: recentDup, error: dupErr } = await admin
      .from("activities")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("booth_id", boothRow.id)
      .gte("created_at", sinceIso)
      .limit(1);
    if (dupErr) throw dupErr;
    if (recentDup?.length) {
      return NextResponse.json(
        { ok: false, error: "너무 빠른 재시도입니다." },
        { status: 429, headers: res.headers }
      );
    }

    // 3) 멱등성 체크
    if (client_event_id) {
      const { data: existed, error: existErr } = await admin
        .from("activities")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("client_event_id", client_event_id)
        .maybeSingle();
      if (existErr) throw existErr;
      if (existed) {
        return NextResponse.json(
          { ok: true, duplicated: true, debug: isDev ? { step: "idempotent-hit" } : undefined },
          { headers: res.headers }
        );
      }
    }

    // 4) insert (호환성을 위해 event_id도 함께 기록)
    const payload = {
      user_id: session.user.id,
      booth_id: boothRow.id,
      amount,
      kind,
      client_event_id: client_event_id || null,
      event_id: client_event_id || null,
    };

    const { data: insData, error: insErr } = await admin
      .from("activities")
      .insert(payload)
      .select("id, created_at")
      .maybeSingle();

    if (insErr) {
      if ((insErr.code === "23505" || `${insErr.message}`.includes("duplicate")) && client_event_id) {
        return NextResponse.json(
          { ok: true, duplicated: true, debug: isDev ? { step: "unique-violation" } : undefined },
          { headers: res.headers }
        );
      }
      throw insErr;
    }

    return NextResponse.json(
      {
        ok: true,
        inserted_id: insData?.id ?? null,
        debug: isDev ? { payload, boothRow, user: session.user.id } : undefined,
      },
      { headers: res.headers }
    );
  } catch (e) {
    console.error("[/api/scan] ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "server error" },
      { status: 500, headers: res.headers }
    );
  }
}
