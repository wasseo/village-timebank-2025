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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: res.headers });
  }

  try {
    const userId = session.user.id;

    // --- 0) 쿼리 파라미터: limit / cursor ---
    const urlObj = new URL(req.url);
    const sp = urlObj.searchParams;

    const limitRaw = sp.get("limit");
    const limit = Math.min(Math.max(parseInt(limitRaw || "10", 10) || 10, 1), 50); // 1~50
    const cursor = sp.get("cursor"); // "ISO,id" 또는 "ISO"

    // --- 1) 최근 활동 (페이징) ---
    // FK명이 표준(activities_booth_id_fkey)이 아닐 경우:
    // .select("..., booths!<fk_name>(name)") 로 교체
    let q = supabase
      .from("activities")
      .select("id, booth_id, amount, kind, created_at, booths(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    // 커서가 있으면 keyset 조건 추가
    if (cursor) {
      const [ts, id] = cursor.split(",");
      if (ts && id) {
        // (created_at < ts) OR (created_at = ts AND id < id)
        // supabase-js의 or()는 PostgREST 표현식 문자열을 받음
        q = q.or(`and(created_at.lt.${ts}),and(created_at.eq.${ts},id.lt.${id})`);
      } else if (ts) {
        // 타임스탬프만으로 페이지네이션(동일시각 다건 드문 경우 OK)
        q = q.lt("created_at", ts);
      }
    }

    const { data: list, error: listErr } = await q;
    if (listErr) {
      return NextResponse.json({ ok: false, error: listErr.message }, { status: 400, headers: res.headers });
    }

    // 다음 커서 계산
    const last = Array.isArray(list) && list.length > 0 ? list[list.length - 1] : null;
    const nextCursor = last ? `${last.created_at},${last.id}` : null;
    const hasMore = Array.isArray(list) && list.length === limit && !!nextCursor;

    // --- 2) 요약 집계 (전체 기간) ---
    // 최소 변경: 기존 로직 유지
    const { data: allActs, error: actsErr } = await supabase
      .from("activities")
      .select("booth_id, amount, kind")
      .eq("user_id", userId);

    if (actsErr) {
      return NextResponse.json({ ok: false, error: actsErr.message }, { status: 400, headers: res.headers });
    }

    // --- 3) 이 사용자가 사용한 booth_id만 뽑아서 타깃 가중치 로드 ---
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

    // --- 4) 요약 집계 ---
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

    // --- 5) 응답 ---
    return NextResponse.json(
      { ok: true, list: list || [], summary, nextCursor, hasMore },
      { headers: res.headers }
    );
  } catch (e) {
    console.error("[/api/activities] error:", e);
    return NextResponse.json({ ok: false, error: e.message || "server error" }, { status: 500, headers: res.headers });
  }
}
