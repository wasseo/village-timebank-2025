// src/app/api/admin/metrics/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY; // 서버 전용 키
if (!url || !key) console.warn("Admin metrics: missing Supabase URL or SERVICE ROLE KEY");

export async function GET() {
  try {
    const supabase = createClient(url, key);

    // 기간토글 : day1(테스트기간~10/18), day2(10/19~)
    const EVENT_TZ = "+09:00"; // KST
    const DAY1_END_KST = "2025-10-18T23:59:59.999" + EVENT_TZ;
    const DAY2_START_KST = "2025-10-19T00:00:00.000" + EVENT_TZ;
    const range = (new URLSearchParams(new URL(request.url).search).get("range") || "").toLowerCase();
    // 넉넉히 30일 범위 로드 후 메모리 필터 (간단/안전)
    const sinceISO = new Date("2025-10-01T00:00:00.000Z").toISOString();

    // activities
    const { data: acts, error: aErr } = await supabase
      .from("activities")
      .select("id,user_id,booth_id,kind,amount,category,created_at")
      .gte("created_at", sinceISO);
    if (aErr) throw aErr;

    // KST 경계로 메모리 필터링
    const day1End = new Date(DAY1_END_KST).toISOString();
    const day2Start = new Date(DAY2_START_KST).toISOString();
    const actsInRange =
      range === "day1" ? acts.filter(a => a.created_at <= day1End) :
      range === "day2" ? acts.filter(a => a.created_at >= day2Start) :
      acts; // 기본: 전체

    // booths (이름 매핑용)
    const { data: booths, error: bErr } = await supabase
      .from("booths")
      .select("id,name");
    if (bErr) throw bErr;
    const boothName = new Map((booths || []).map(b => [b.id, b.name || b.id]));

    // profiles (유저 이름 매핑 – 없으면 user_id 그대로)
    let profileMap = new Map();
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,full_name,display_name,name");
      profileMap = new Map(
        (profiles || []).map(p => [
          p.id,
          p.display_name || p.full_name || p.name || p.id
        ])
      );
    } catch {}

    // 유틸
    const by = (arr, keyFn) => {
      const m = new Map();
      for (const x of arr) {
        const k = keyFn(x);
        m.set(k, (m.get(k) || []).concat(x));
      }
      return m;
    };
    const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

    // 0) 전체 활동포인트 – 일자별 합계 (LineChart 용)
    const byDay = by(actsInRange, x => (x.created_at || "").slice(0, 10)); // YYYY-MM-DD
    const timeSeries = Array.from(byDay.entries())
      .map(([day, rows]) => ({ day, total: sum(rows, r => r.amount || 0) }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // 공통: 랭킹 유틸 (합계 내림차순, 동점 시 가장 이른 created_at 우선)
    function rankTop(list, keyFn) {
      const grouped = by(list, keyFn);
      const scored = Array.from(grouped.entries()).map(([k, rows]) => ({
        key: k,
        total: sum(rows, r => r.amount || 0),
        firstAt: rows.reduce((t, r) => Math.min(t, +new Date(r.created_at)), +new Date())
      }));
      scored.sort((a, b) => (b.total - a.total) || (a.firstAt - b.firstAt));
      return scored.slice(0, 3);
    }

    // 1) 총 활동이 많은 사람 Top3
    const topUsersOverall = rankTop(actsInRange, x => x.user_id)
      .map(r => ({ id: r.key, name: profileMap.get(r.key) || r.key, total: r.total }));

    // 2) 적립 활동이 많은 사람 Top3
    const earnActs = actsInRange.filter(a => (a.kind || "earn") === "earn");
    const topUsersEarn = rankTop(earnActs, x => x.user_id)
      .map(r => ({ id: r.key, name: profileMap.get(r.key) || r.key, total: r.total }));

    // 3) 교환 활동이 많은 사람 Top3
    const redeemActs = actsInRange.filter(a => a.kind === "redeem");
    const topUsersRedeem = rankTop(redeemActs, x => x.user_id)
      .map(r => ({ id: r.key, name: profileMap.get(r.key) || r.key, total: r.total }));

    // 4) 적립 활동이 많은 부스 Top3
    const topBoothsEarn = rankTop(earnActs, x => x.booth_id)
      .map(r => ({ id: r.key, name: boothName.get(r.key) || r.key, total: r.total }));

    // 5) 교환 활동이 많은 부스 Top3
    const topBoothsRedeem = rankTop(redeemActs, x => x.booth_id)
      .map(r => ({ id: r.key, name: boothName.get(r.key) || r.key, total: r.total }));

    // 6) 분야 합계 (RadarChart 용)
    const domains = ["environment","social","economic","mental"];
    const domainTotals = domains.map(d => ({
      domain: d,
      total: sum(actsInRange.filter(a => (a.category || "") === d), x => x.amount || 0)
    }));

    return NextResponse.json({
      ok: true,
      timeSeries,
      topUsersOverall,
      topUsersEarn,
      topUsersRedeem,
      topBoothsEarn,
      topBoothsRedeem,
      domainTotals,
    });
  } catch (e) {
    console.error("admin metrics error:", e);
    return NextResponse.json({ ok: false, error: e.message || "unknown" }, { status: 500 });
  }
}
