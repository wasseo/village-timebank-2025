// src/app/api/admin/metrics/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // 서버 전용 키
if (!url || !key) console.warn("Admin metrics: missing Supabase URL or SERVICE ROLE KEY");

export async function GET(request) {
  try {
    const supabase = createClient(url, key);

    // ── 기간 토글: day1(테스트기간~10/18), day2(10/19~) ─────────────────────────────
    const DAY1_END_KST   = "2025-10-18T23:59:59.999+09:00";
    const DAY2_START_KST = "2025-10-19T00:00:00.000+09:00";
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") || "").toLowerCase();

    // 넉넉히 10월 전 기간부터 로드(안전), 이후 메모리에서 필터
    const sinceISO = new Date("2025-10-01T00:00:00.000Z").toISOString();

    // ── 데이터 로드 ────────────────────────────────────────────────────────────────
    const { data: acts, error: aErr } = await supabase
      .from("activities")
      .select("id,user_id,booth_id,kind,amount,category,created_at")
      .gte("created_at", sinceISO);
    if (aErr) throw aErr;

    const day1End   = new Date(DAY1_END_KST).toISOString();
    const day2Start = new Date(DAY2_START_KST).toISOString();
    const actsInRange =
      range === "day1" ? acts.filter(a => a.created_at <= day1End) :
      range === "day2" ? acts.filter(a => a.created_at >= day2Start) :
      acts;

    const { data: booths, error: bErr } = await supabase
      .from("booths")
      .select("id,name");
    if (bErr) throw bErr;
    const boothName = new Map((booths || []).map(b => [b.id, b.name || b.id]));

    // 프로필: name, phone만
    let profileMap = new Map();
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,name,phone");
      profileMap = new Map(
        (profiles || []).map(p => [
          p.id,
          { name: p.name || p.id, phone: p.phone || "" }
        ])
      );
    } catch {}

    // ── 유틸 ──────────────────────────────────────────────────────────────────────
    const by = (arr, keyFn) => {
      const m = new Map();
      for (const x of arr) {
        const k = keyFn(x);
        m.set(k, (m.get(k) || []).concat(x));
      }
      return m;
    };
    const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

    // ── 0) 일자별 합계(LineChart) + 시간대별 합계(LineChart) + 전체 합계 ───────────
    const byDay = by(actsInRange, x => (x.created_at || "").slice(0, 10)); // YYYY-MM-DD
    const timeSeries = Array.from(byDay.entries())
      .map(([day, rows]) => ({ day, total: sum(rows, r => r.amount || 0) }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // 시간대별(KST) 0~23
    function kstHour(ts) {
      const d = new Date(ts);
      const k = new Date(d.getTime() + 9 * 60 * 60 * 1000); // UTC+9
      return k.getUTCHours(); // 0..23
    }
    const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      total: 0,
    }));
    for (const a of actsInRange) {
      const h = kstHour(a.created_at);
      hourlySeries[h].total += Number(a.amount) || 0;
    }

    const totalSum = sum(actsInRange, r => r.amount || 0);

    // ── 랭킹 유틸: 합계 desc, 동점은 first created_at asc ──────────────────────────
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

    // ── 1~3) 유저 Top3 (전체/적립/교환) ────────────────────────────────────────────
    const topUsersOverall = rankTop(actsInRange, x => x.user_id).map(r => {
      const p = profileMap.get(r.key);
      return { id: r.key, name: p?.name || r.key, phone: p?.phone || "", total: r.total };
    });

    const earnActs = actsInRange.filter(a => (a.kind || "earn") === "earn");
    const topUsersEarn = rankTop(earnActs, x => x.user_id).map(r => {
      const p = profileMap.get(r.key);
      return { id: r.key, name: p?.name || r.key, phone: p?.phone || "", total: r.total };
    });

    const redeemActs = actsInRange.filter(a => a.kind === "redeem");
    const topUsersRedeem = rankTop(redeemActs, x => x.user_id).map(r => {
      const p = profileMap.get(r.key);
      return { id: r.key, name: p?.name || r.key, phone: p?.phone || "", total: r.total };
    });

    // ── 4~5) 부스 Top3 (적립/교환) ────────────────────────────────────────────────
    const topBoothsEarn = rankTop(earnActs, x => x.booth_id)
      .map(r => ({ id: r.key, name: boothName.get(r.key) || r.key, total: r.total }));
    const topBoothsRedeem = rankTop(redeemActs, x => x.booth_id)
      .map(r => ({ id: r.key, name: boothName.get(r.key) || r.key, total: r.total }));

    // ── 6) 분야 합계 (레이더) ─────────────────────────────────────────────────────
    const domains = ["environment", "social", "economic", "mental"];
    const domainTotals = domains.map(d => ({
      domain: d,
      total: sum(actsInRange.filter(a => (a.category || "") === d), x => x.amount || 0),
    }));

    // ── 응답 ──────────────────────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      totalSum,
      timeSeries,
      hourlySeries,
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
