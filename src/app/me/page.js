"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DOMAINS = ["environment", "social", "economic", "mental"];

export default function MePage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [activities, setActivities] = useState([]);
  const [targets, setTargets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  // ✅ 합계(표시는 summary 기반; summary 없을 때만 로컬 산출)
  const localTotals = useMemo(() => {
    const earn = activities
      .filter((a) => a.kind === "earn")
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const redeem = activities
      .filter((a) => a.kind === "redeem")
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const total = earn + redeem;
    return { total, earn, redeem };
  }, [activities]);

  const totals = summary
    ? {
        total: summary.total_points ?? 0,
        earn: summary.earn_points ?? 0,
        redeem: summary.redeem_points ?? 0,
      }
    : localTotals;

  // ✅ 레이더 데이터: summary 값 사용 (정확/간단)
  const radar = useMemo(() => {
    if (summary) {
      return DOMAINS.map((d) => ({
        domain: d,
        value: Number(summary[d] ?? 0),
      }));
    }
    // (백업) summary가 오기 전, 활동×타겟으로 임시 계산
    const byDomain = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
    if (!activities.length || !targets.length) {
      return DOMAINS.map((d) => ({ domain: d, value: 0 }));
    }
    const map = targets.reduce((acc, t) => {
      if (!acc[t.booth_id]) acc[t.booth_id] = [];
      // factor 우선, 없으면 weight, 둘 다 없으면 1
      const weight = Number(t.factor ?? t.weight ?? 1);
      acc[t.booth_id].push({ domain_code: t.domain_code, weight });
      return acc;
    }, {});
    for (const a of activities) {
      const tlist = map[a.booth_id] || [];
      const amt = Number(a.amount || 0);
      for (const t of tlist) {
        if (!t?.domain_code) continue;
        byDomain[t.domain_code] = (byDomain[t.domain_code] || 0) + amt * (isNaN(t.weight) ? 0 : t.weight);
      }
    }
    return DOMAINS.map((d) => ({ domain: d, value: byDomain[d] || 0 }));
  }, [summary, activities, targets]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) iron-session 사용자 확인
        const me = await fetch("/api/me").then((r) => r.json()).catch(() => null);
        const uid = me?.user?.id;
        if (!uid) throw new Error("로그인이 필요합니다.");
        if (!mounted) return;
        setUserId(uid);

        // 2) 요약(서버 뷰) 먼저 가져오기 → 합계/레이더는 이걸 기준으로
        const sres = await fetch("/api/me/summary").then((r) => r.json());
        if (sres?.ok) setSummary(sres.summary);

        // 3) 활동 목록 (리스트 표시용)
        const { data: acts, error: aErr } = await supabase
          .from("activities")
          .select("id, user_id, booth_id, amount, kind, created_at, client_event_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });
        if (aErr) throw aErr;
        if (!mounted) return;
        setActivities(acts || []);

        // 4) 부스 타겟 (summary가 있으면 없어도 되지만, 레이더 대체 계산/디버그용)
        const boothIds = Array.from(new Set((acts || []).map((a) => a.booth_id))).filter(Boolean);
        if (boothIds.length) {
          const { data: tgs, error: tErr } = await supabase
            .from("booth_targets")
            .select("booth_id, domain_code, factor, weight")
            .in("booth_id", boothIds);
          if (tErr) throw tErr;
          if (!mounted) return;
          setTargets(tgs || []);
        } else {
          setTargets([]);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setError(e.message || "데이터를 불러오지 못했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">내 활동</h1>
        <p className="text-sm text-gray-500">
          교환(redeem)도 “양수”로 누적해요. UI에서만 교환/적립으로 구분합니다.
        </p>
      </header>

      {/* 합계 카드 */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-sm text-gray-500">총 합계</div>
          <div className="mt-1 text-2xl font-semibold">+{totals.total}</div>
        </div>
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-sm text-gray-500">적립(Earn)</div>
          <div className="mt-1 text-2xl font-semibold">+{totals.earn}</div>
        </div>
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-sm text-gray-500">교환(Redeem)</div>
          <div className="mt-1 text-2xl font-semibold">+{totals.redeem}</div>
        </div>
      </section>

      {/* 레이더 차트 */}
      <section className="rounded-2xl border p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">활동 자산 레이더</h2>
          <span className="text-xs text-gray-500">도메인 가중치 × 금액 합</span>
        </div>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radar}>
              <PolarGrid />
              <PolarAngleAxis dataKey="domain" />
              <PolarRadiusAxis />
              <Radar
                name="activity"
                dataKey="value"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.5}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 활동 리스트 */}
      <section className="rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">최근 활동</h2>
        </div>
        <div className="divide-y">
          {loading && <div className="p-4 text-sm text-gray-500">불러오는 중…</div>}
          {error && <div className="p-4 text-sm text-red-600">에러: {error}</div>}
          {!loading && !error && activities.length === 0 && (
            <div className="p-4 text-sm text-gray-500">활동이 아직 없습니다.</div>
          )}
          {activities.map((row) => (
            <div key={row.id} className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">
                  {row.kind === "redeem" ? "교환" : "적립"}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(row.created_at).toLocaleString()}
                </div>
              </div>
              <span className="font-semibold">+{row.amount}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 디버그 */}
      <details className="rounded-2xl border p-4 shadow-sm">
        <summary className="cursor-pointer font-medium">디버그 정보</summary>
        <pre className="mt-3 text-xs overflow-auto">
{JSON.stringify(
  {
    userId,
    totals,
    summary,
    activitiesCount: activities.length,
    targetsCount: targets.length,
  },
  null,
  2
)}
        </pre>
      </details>
    </div>
  );
}
