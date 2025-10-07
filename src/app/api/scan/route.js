//src/app/api/scan/route.js

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // iron-session은 edge 미지원

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const RECENT_DUP_SECONDS = 20;
const isDev = process.env.NODE_ENV !== "production";

/** URL/문자열 정규화: 어떤 형태로 와도 booth_id/code를 최대한 뽑아낸다 */
function normalizeScanInput({ booth_id_param, code_param }) {
  let out = {
    b: (booth_id_param || "").trim(),
    code: (code_param || "").trim(),
  };

  // 이미 booth_id가 있으면 우선 사용
  if (out.b) return out;

  // code가 URL이면 /scan|/s|/booth 또는 쿼리에서 뽑는다
  if (out.code && /^https?:\/\//i.test(out.code)) {
    try {
      const u = new URL(out.code);

      // 쿼리 우선
      const qpCode  = (u.searchParams.get("code") || u.searchParams.get("c") || "").trim();
      const qpBooth = (u.searchParams.get("b") || u.searchParams.get("booth_id") || "").trim();
      if (qpBooth) return { b: qpBooth, code: "" };
      if (qpCode)  return { b: "", code: qpCode };

      // path 패턴
      const mScan = u.pathname.match(/\/(scan|s)\/([A-Za-z0-9\-_.~]+)/);
      if (mScan?.[2]) return { b: "", code: mScan[2] };

      const mBooth = u.pathname.match(/\/booth\/([A-Za-z0-9\-_.~]+)/);
      if (mBooth?.[1]) return { b: mBooth[1], code: "" };

      // 그 외는 전체 URL을 code로 유지 (서버에서 code 매칭 시도)
      return out;
    } catch {
      return out;
    }
  }

  return out;
}

export async function POST(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // 입력 파라미터 수집
    const booth_id_param  = (body?.b || body?.booth_id || "").trim();
    const code_param      = (body?.code || body?.c || "").trim();
    const client_event_id = body?.client_event_id ?? body?.e ?? null;

    // ✅ 정규화
    const norm = normalizeScanInput({ booth_id_param, code_param });
    const boothIdForQuery = norm.b;
    const codeForQuery    = norm.code;

    if (!boothIdForQuery && !codeForQuery) {
      return NextResponse.json(
        { ok: false, error: "booth_id(b) 또는 code 가 필요합니다." },
        { status: 400, headers: res.headers }
      );
    }

    // 1) 부스 조회 (booth_id 우선 → 없으면 code 매칭)
    let boothRow = null;
    if (boothIdForQuery) {
      const { data, error } = await admin
        .from("booths")
        .select("id, kind, amount, is_active")
        .eq("id", boothIdForQuery)
        .maybeSingle();
      if (error) throw error;
      boothRow = data;
    } else {
      const { data, error } = await admin
        .from("booths")
        .select("id, kind, amount, is_active")
        .eq("code", codeForQuery)
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

    // 2) 최근 중복 방지 (동일 부스에 연속 스캔)
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

    // 3) 멱등성(클라이언트 이벤트 ID)
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

    // 4) insert (호환: event_id에도 동일 값 표시)
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
      // unique 위반(멱등) 방어
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
