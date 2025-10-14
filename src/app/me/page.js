// src/app/me/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer
} from "recharts";

export default function MyPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState({
    total: 0,
    byKind: { earn: 0, redeem: 0 },
    byCategory: { environment: 0, social: 0, economic: 0, mental: 0 },
  });
  const [list, setList] = useState([]);
  const [userName, setUserName] = useState("");

  // (3) 최근활동 더보기 토글 상태
  const [showAll, setShowAll] = useState(false);
  const VISIBLE_COUNT = 6;

  useEffect(() => {
    (async () => {
      try {
        // 로그인 확인
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          const next = encodeURIComponent("/me");
          location.href = `/login?next=${next}`;
          return;
        }
        // 이름(있으면) 표시용
        const metaName = me?.user?.user_metadata?.name || me?.profile?.name || "";
        setUserName(metaName);

        // 활동 요약 + 최근 활동
        const acts = await fetch("/api/activities").then(r => r.json());
        if (!acts?.ok) throw new Error(acts?.error || "활동을 불러오지 못했습니다.");

        setSummary(acts.summary || {});
        setList(Array.isArray(acts.list) ? acts.list : []);
      } catch (e) {
        setErr(e.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const KR = {
    environment: "환경",
    social: "사회",
    economic: "경제",
    mental: "정신",
  };

  // 레이더 데이터
  const radarData = useMemo(
    () => ([
      { domain: "environment", total: summary.byCategory?.environment || 0 },
      { domain: "social",      total: summary.byCategory?.social      || 0 },
      { domain: "mental",      total: summary.byCategory?.mental      || 0 },
      { domain: "economic",    total: summary.byCategory?.economic    || 0 },
    ]),
    [
      summary.byCategory?.environment,
      summary.byCategory?.social,
      summary.byCategory?.mental,
      summary.byCategory?.economic,
    ]
  );

  if (loading) return <main className="min-h-screen bg-[#FFF7E3] p-6">불러오는 중…</main>;
  if (err) return <main className="min-h-screen bg-[#FFF7E3] p-6 text-red-600">에러: {err}</main>;

  const fmtPlus = (n) => `+${Number(n || 0)}`;

  const StatCard = ({ title, value, tone = "blue", sub }) => {
    const tones = {
      blue: { ring: "ring-[#2843D1]/30", iconBg: "bg-[#2843D1]/10", icon: "text-[#2843D1]" },
      green:{ ring: "ring-[#27A36D]/30", iconBg: "bg-[#27A36D]/10", icon: "text-[#27A36D]" },
      lilac:{ ring: "ring-[#8F8AE6]/30", iconBg: "bg-[#8F8AE6]/10", icon: "text-[#8F8AE6]" },
    }[tone];

    return (
      <div className={`rounded-2xl bg-white ring-1 ${tones.ring} p-3 md:p-4 shadow-sm`}>
        <div className="flex items-center gap-2">
          <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center ${tones.iconBg}`}>
            <span className={`text-base ${tones.icon}`}>●</span>
          </span>
          {/* (2) 라벨 글자 키움 */}
          <div className="text-base md:text-lg font-semibold text-[#223D8F]">{title}</div>
        </div>
        {/* 값은 약간 줄여서 모바일 3열 맞춤 */}
        <div className="mt-1 text-2xl md:text-3xl font-extrabold text-[#1F2C5D]">{Number(value || 0)}</div>
        {sub ? <div className="text-xs text-[#223D8F] mt-1">{sub}</div> : null}
      </div>
    );
  };

  // 부스명 표시
  const ActivityItem = ({ a }) => {
    const boothName = a?.booths?.name ?? a?.booth_name ?? a?.booth_id;
    const d = new Date(a.created_at);
    const when = isNaN(+d)
      ? ""
      : d.toLocaleString("ko-KR", {
          month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
        });
    const kindLabel = a.kind === "redeem" ? "교환" : "적립";
    return (
      <li className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-[#2843D1]/5 transition">
        <div className="text-sm">
          <div className="font-medium text-[#1F2C5D]">
            {boothName} <span className="text-[#64748B]">· {kindLabel}</span>
          </div>
          <div className="text-[#94A3B8]">{when}</div>
        </div>
        <div className="font-mono text-[#27A36D]">{fmtPlus(a.amount)}</div>
      </li>
    );
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  };

  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D]">
      {/* 상단 인사 & 액션 */}
      <div className="max-w-3xl mx-auto px-6 pt-7 pb-2 flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">
          마을시간은행
        </h1>
        <div className="flex gap-2">
          <Link href="/scan" className="rounded-xl px-4 py-2 bg-[#2843D1] text-white font-semibold shadow-sm hover:opacity-95">
            부스 입력
          </Link>
        </div>
      </div>

      {/* (1) 요약 카드: 항상 3열 한 줄 고정 */}
      <section className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-3 mt-2">
        <StatCard title="적립" value={summary.byKind?.earn} tone="green" />
        <StatCard title="교환" value={summary.byKind?.redeem} tone="blue" />
        <StatCard title="총 마음포인트 (적립 + 교환)" value={summary.total} tone="lilac" />
      </section>

      {/* 활동자산 레이더 */}
      <section className="max-w-3xl mx-auto px-6 mt-6">
        <div className="rounded-3xl bg-white ring-1 ring-[#A1E1A4]/30 p-5 shadow-sm">
          <div className="font-semibold mb-3">활동자산</div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" tickFormatter={(d) => KR[d] || d} />
                <PolarRadiusAxis />
                {/* 외곽은 파랑, 채움은 연녹(디자인 톤) */}
                <Radar dataKey="total" stroke="#2843D1" fill="#27A36D" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* (3) 최근 활동 + 더보기/접기 */}
      <section className="max-w-3xl mx-auto px-6 mt-6 mb-10">
        <div className="rounded-3xl bg-white ring-1 ring-[#2843D1]/15 p-5 shadow-sm">
          <div className="font-semibold mb-2">최근 활동</div>
          {list.length === 0 ? (
            <div className="text-[#94A3B8] text-sm">활동이 아직 없습니다.</div>
          ) : (
            <>
              <ul className="divide-y divide-[#E2E8F0]">
                {(showAll ? list : list.slice(0, VISIBLE_COUNT)).map((a) => (
                  <ActivityItem key={a.id} a={a} />
                ))}
              </ul>

              {list.length > VISIBLE_COUNT && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="px-4 py-2 rounded-xl bg-white ring-1 ring-[#2843D1]/30 text-[#2843D1] font-semibold hover:bg-[#2843D1]/5"
                  >
                    {showAll ? "접기" : "전체 보기"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
