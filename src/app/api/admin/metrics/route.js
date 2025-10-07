// src/app/api/admin/metrics/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // 서버 전용 키
if (!url || !key) console.warn("Admin metrics: missing Supabase URL or SERVICE ROLE KEY");

// ── 간단 메모리 캐시 (인스턴스별) ─────────────────────────────────────────────
const CACHE_TTL_MS = Number(process.env.ADMIN_METRICS_TTL_MS || 90_000); // 기본 90초
const metricsCache = {
  // range별 캐시: { at: number, payload: object }
  day1: null,
  day2: null,
  all: null,
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") || "").toLowerCase(); // "day1" | "day2" | ""
  const keyByRange = range === "day1" ? "day1" : range === "day2" ? "day2" : "all";
  const force = searchParams.get("force") === "1";

  // 캐시 적중 시 바로 반환
  const cached = metricsCache[keyByRange];
  const now = Date.now();
  if (!force && cached && (now - cached.at) < CACHE_TTL_MS) {
    return jsonWithCacheHeaders(cached.payload);
  }

  try {
    const supabase = createClient(url, key);

    // ── 기간 토글: day1(테스트기간~10/18), day2(10/19~) ─────────────────────────
    const DAY1_END_KST   = "2025-10-18T23:59:59.999+09:00";
    const DAY2_START_KST = "2025-10-19T00:00:00.000+09:00";
    const DAY1_END_ISO   = new Date(DAY1_END_KST).toISOString();
    const DAY2_START_ISO = new Date(DAY2_START_KST).toISOString();

    // 넉넉히 10월 전 기간부터 로드(안전), 이후 메모리에서 필터
    const sinceISO = new Date("2025-10-01T00:00:00.000Z").toISOString();

    // ── 데이터 로드 ─────────────────────────────────────────────────────────────
    const { data: acts, error: aErr } = await supabase
      .from("activities")
      .select("id,user_id,booth_id,kind,amount,created_at")
      .gte("created_at", sinceISO);
    if (aErr) throw aErr;

    const { data: booths, error: bErr } = await supabase
      .from("booths")
      .select("id,name");
    if (bErr) throw bErr;

    // booth_targets로 도메인/가중치 반영
    const { data: targets, error: tErr } = await supabase
      .from("booth_targets")
      .select("booth_id, domain_code, weight");
    if (tErr) throw tErr;

    // ── 범위 필터 ───────────────────────────────────────────────────────────────
    const actsInRange =
      range === "day1" ? acts.filter(a => a.created_at <= DAY1_END_ISO) :
      range === "day2" ? acts.filter(a => a.created_at >= DAY2_START_ISO) :
      acts;

    // ── 맵/유틸 ─────────────────────────────────────────────────────────────────
    const boothName = new Map((booths || []).map(b => [b.id, b.name || b.id]));
    const by = (arr, keyFn) => {
      const m = new Map();
      for (const x of arr) {
        const k = keyFn(x);
        m.set(k, (m.get(k) || []).concat(x));
      }
      return m;
    };
    const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

    // ── 0) 일자별/시간대별 + 전체 합계 ──────────────────────────────────────────
    const byDay = by(actsInRange, x => (x.created_at || "").slice(0, 10)); // YYYY-MM-DD
    const timeSeries = Array.from(byDay.entries())
      .map(([day, rows]) => ({ day, total: sum(rows, r => r.amount || 0) }))
      .sort((a, b) => a.day.localeCompare(b.day));

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

    // ── 랭킹 유틸 ───────────────────────────────────────────────────────────────
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

    const earnActs = actsInRange.filter(a => (a.kind || "earn") === "earn");
    const redeemActs = actsInRange.filter(a => a.kind === "redeem");

    const topUsersOverall = rankTop(actsInRange, x => x.user_id);
    const topUsersEarn    = rankTop(earnActs,    x => x.user_id);
    const topUsersRedeem  = rankTop(redeemActs,  x => x.user_id);

    // 프로필 이름/전화 붙이기 (선택)
    let profileMap = new Map();
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,name,phone");
      profileMap = new Map(
        (profiles || []).map(p => [p.id, { name: p.name || p.id, phone: p.phone || "" }])
      );
    } catch {}

    const mapUserDisplay = (r) => {
      const p = profileMap.get(r.key);
      return { id: r.key, name: p?.name || r.key, phone: p?.phone || "", total: r.total };
    };

    // 사용자 Top3 payload
    const topUsersOverallOut = topUsersOverall.map(mapUserDisplay);
    const topUsersEarnOut    = topUsersEarn.map(mapUserDisplay);
    const topUsersRedeemOut  = topUsersRedeem.map(mapUserDisplay);

    // ── 부스 Top3 ───────────────────────────────────────────────────────────────
    const topBoothsEarn = rankTop(earnActs, x => x.booth_id)
      .map(r => ({ id: r.key, name: boothName.get(r.key) || r.key, total: r.total }));
    const topBoothsRedeem = rankTop(redeemActs, x => x.booth_id)
      .map(r => ({ id: r.key, name: boothName.get(r.key) || r.key, total: r.total }));

    // ── 6) 분야 합계(환경·사회·경제·정신): booth_targets 기반 계산 ──────────────
    // booth_id → [{ domain, weight }, ...]
    const targetsByBooth = new Map();
    for (const t of (targets || [])) {
      const w = Number(t.weight || 1);
      const d = t.domain_code; // 'environment' | 'social' | 'economic' | 'mental'
      if (!d) continue;
      if (!targetsByBooth.has(t.booth_id)) targetsByBooth.set(t.booth_id, []);
      targetsByBooth.get(t.booth_id).push({ domain: d, weight: w });
    }

    const domains = ["environment", "social", "economic", "mental"];
    const domainSums = new Map(domains.map(d => [d, 0]));

    for (const a of actsInRange) {
      const arr = targetsByBooth.get(a.booth_id);
      if (!arr) continue;
      const base = Number(a.amount) || 0;
      for (const { domain, weight } of arr) {
        if (domainSums.has(domain)) {
          domainSums.set(domain, domainSums.get(domain) + base * (Number(weight) || 1));
        }
      }
    }
    const domainTotals = domains.map(d => ({ domain: d, total: domainSums.get(d) }));

    // ── 응답 생성 & 캐시 저장 ───────────────────────────────────────────────────
    const payload = {
      ok: true,
      totalSum,
      timeSeries,
      hourlySeries,
      topUsersOverall: topUsersOverallOut,
      topUsersEarn:    topUsersEarnOut,
      topUsersRedeem:  topUsersRedeemOut,
      topBoothsEarn,
      topBoothsRedeem,
      domainTotals,
      _meta: { cachedAt: new Date().toISOString(), ttlMs: CACHE_TTL_MS }
    };

    metricsCache[keyByRange] = { at: Date.now(), payload };
    return jsonWithCacheHeaders(payload);

  } catch (e) {
    console.error("admin metrics error:", e);
    return NextResponse.json({ ok: false, error: e.message || "unknown" }, { status: 500 });
  }
}

function jsonWithCacheHeaders(payload) {
  const res = NextResponse.json(payload);
  // CDN/Server 캐시 힌트 (Vercel 환경에서 유효)
  res.headers.set("Cache-Control", `public, s-maxage=${Math.floor(CACHE_TTL_MS/1000)}, stale-while-revalidate=30`);
  return res;
}
