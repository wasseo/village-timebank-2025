// src/app/api/activities/route.js
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // iron-session은 edge 미지원

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // 서버 전용
const supabase = createClient(url, key);

export async function GET(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // 1) 최근 활동 2건 (부스명 조인)
    // FK가 표준명(activities_booth_id_fkey) 아니라면 아래 select를 FK명으로 바꾸세요:
    //   .select("..., booths!<fk_name>(name)")
    const { data: list, error: listErr } = await supabase
      .from("activities")
      .select("id, booth_id, amount, kind, created_at, booths(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (listErr) {
      return NextResponse.json({ ok: false, error: listErr.message }, { status: 400, headers: res.headers });
    }

    // 2) 요약 집계용: 사용자 전체 활동(기간 제한 없음) 로드
    const { data: allActs, error: actsErr } = await supabase
      .from("activities")
      .select("booth_id, amount, kind")
      .eq("user_id", userId);

    if (actsErr) {
      return NextResponse.json({ ok: false, error: actsErr.message }, { status: 400, headers: res.headers });
    }

    // 3) 이 사용자가 사용한 booth_id만 뽑아서 타깃 가중치 로드
    const boothIds = Array.from(new Set((allActs || []).map(a => a.booth_id).filter(Boolean)));
    let targetsByBooth = new Map();
    if (boothIds.length) {
      const { data: targets, error: tErr } = await supabase
        .from("booth_targets")
        .select("booth_id, domain_code, weight")
        .in("booth_id", boothIds);

      if (tErr) {
        return NextResponse.json({ ok: false, error: tErr.message }, { status: 400, headers: res.headers });
      }

      targetsByBooth = new Map();
      for (const t of targets || []) {
        if (!targetsByBooth.has(t.booth_id)) targetsByBooth.set(t.booth_id, []);
        targetsByBooth.get(t.booth_id).push({
          domain: t.domain_code,                // 'environment' | 'social' | 'economic' | 'mental'
          weight: Number(t.weight ?? 1) || 1,   // 기본 1
        });
      }
    }

    // 4) 요약 집계
    const summary = {
      total: 0,
      byKind: { earn: 0, redeem: 0 },
      byCategory: { environment: 0, social: 0, economic: 0, mental: 0 },
    };

    for (const a of allActs || []) {
      const amt = Number(a.amount || 0);
      summary.total += amt;
      if (a.kind === "earn")   summary.byKind.earn   += amt;
      if (a.kind === "redeem") summary.byKind.redeem += amt;

      const weights = targetsByBooth.get(a.booth_id);
      if (weights && weights.length) {
        for (const { domain, weight } of weights) {
          if (summary.byCategory[domain] !== undefined) {
            summary.byCategory[domain] += amt * (Number(weight) || 1);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, list: list || [], summary }, { headers: res.headers });
  } catch (e) {
    console.error("[/api/activities] error:", e);
    return NextResponse.json({ ok: false, error: e.message || "server error" }, { status: 500, headers: res.headers });
  }
}
