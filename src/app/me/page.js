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

  // 페이징/표시 상태
  const [pageList, setPageList] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userName, setUserName] = useState("");

  // "처음으로" 복원용 캐시
  const [firstPage, setFirstPage] = useState({ list: [], nextCursor: null, hasMore: true });

  // 표시 개수 제어: 최초 3개, 이후 10개씩 증가
  const INITIAL_VISIBLE = 2;
  const STEP = 10;
  const INITIAL_LIMIT = 10; // 서버 최초 로드도 10개 받아 두고 3개만 보여줌

  // 실제로 화면에 보일 리스트
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const visibleList = useMemo(() => pageList.slice(0, visibleCount), [pageList, visibleCount]);

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
        setUserName(me?.user?.user_metadata?.name || me?.profile?.name || "");

        // 활동 첫 페이지 로드 (요약 함께 수신)
        const url = new URL("/api/activities", location.origin);
        url.searchParams.set("limit", String(INITIAL_LIMIT));
        const acts = await fetch(url).then(r => r.json());
        if (!acts?.ok) throw new Error(acts?.error || "활동을 불러오지 못했습니다.");

        setSummary({
          total: acts?.summary?.total ?? 0,
          byKind: {
            earn: acts?.summary?.byKind?.earn ?? 0,
            redeem: acts?.summary?.byKind?.redeem ?? 0,
          },
          byCategory: {
            environment: acts?.summary?.byCategory?.environment ?? 0,
            social: acts?.summary?.byCategory?.social ?? 0,
            economic: acts?.summary?.byCategory?.economic ?? 0,
            mental: acts?.summary?.byCategory?.mental ?? 0,
          },
        });

        const list = Array.isArray(acts.list) ? acts.list : [];
        setPageList(list);
        setNextCursor(acts.nextCursor || null);
        setHasMore(!!acts.hasMore);

        // 캐시
        setFirstPage({
          list,
          nextCursor: acts.nextCursor || null,
          hasMore: !!acts.hasMore,
        });

        // 최초 표시 개수(3개)로 고정
        setVisibleCount(INITIAL_VISIBLE);
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

  // (옵션) 유지: 필요 시 다른 곳에서 재사용 가능
  const StatCard = ({ title, value, tone = "blue", sub }) => {
    const tones = {
      blue:  { ring: "ring-[#2843D1]/30", iconBg: "bg-[#2843D1]/10", icon: "text-[#2843D1]" },
      green: { ring: "ring-[#27A36D]/30", iconBg: "bg-[#27A36D]/10", icon: "text-[#27A36D]" },
      lilac: { ring: "ring-[#8F8AE6]/30", iconBg: "bg-[#8F8AE6]/10", icon: "text-[#8F8AE6]" },
    }[tone];

    return (
      <div className={`rounded-2xl bg-white ring-1 ${tones.ring} p-3 md:p-4 shadow-sm`}>
        <div className="flex items-center gap-2">
          <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center ${tones.iconBg}`}>
            <span className={`text-base ${tones.icon}`}>●</span>
          </span>
          <div className="text-base md:text-lg font-semibold text-[#223D8F]">{title}</div>
        </div>
        <div className="mt-1 text-2xl md:text-3xl font-extrabold text-[#1F2C5D]">{Number(value || 0)}</div>
        {sub ? <div className="text-xs text-[#223D8F] mt-1">{sub}</div> : null}
      </div>
    );
  };

  // 총합 카드 (칩: 이전 색감 + halo)
  // 총합 카드 (버튼톤 칩 + dot만 halo)
  const TotalCard = ({ total, earn, redeem }) => (
    <div className="rounded-2xl bg-white ring-1 ring-[#8F8AE6]/30 p-4 shadow-sm">
      {/* 타이틀 */}
      <div className="flex items-center gap-3">
        <span className="inline-flex w-9 h-9 rounded-full items-center justify-center bg-[#8F8AE6]/10">
          <span className="text-lg text-[#8F8AE6]">●</span>
        </span>
        <div className="text-lg font-semibold text-[#223D8F]">총 마음포인트</div>
      </div>

      {/* 총합 */}
      <div className="mt-2 text-4xl font-extrabold text-[#1F2C5D]">
        {Number(total || 0)}
      </div>
      <div className="text-xs text-[#64748B] mt-1">(적립 + 교환)</div>

      {/* 칩 UI (버튼톤 + dot만 halo) */} 
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {/* 적립(파랑) */}
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
          style={{ backgroundColor: "rgba(40,67,209,0.18)" }} // #2843D1 18%
        >
          {/* dot + halo */}
          <span
            className="relative w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: "#2843D1",
              boxShadow: "0 0 6px 2px rgba(40,67,209,0.35)",
            }}
          />
          <span className="text-[#1F2C5D] font-medium">적립</span>
          <span className="text-[#1F2C5D] font-semibold">{Number(earn || 0)}</span>
        </span>

        {/* 교환(초록) */}
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
          style={{ backgroundColor: "rgba(39,163,109,0.18)" }} // #27A36D 18%
        >
          {/* dot + halo */}
          <span
            className="relative w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: "#27A36D",
              boxShadow: "0 0 6px 2px rgba(39,163,109,0.35)",
           }}
          />
          <span className="text-[#1F2C5D] font-medium">교환</span>
          <span className="text-[#1F2C5D] font-semibold">{Number(redeem || 0)}</span>
        </span>
      </div>
    </div>
  );


  // 최근활동 아이템
  const ActivityItem = ({ a }) => {
    const boothName = a?.booths?.name ?? a?.booth_name ?? a?.booth_id;
    const d = new Date(a.created_at);
    const when = isNaN(+d)
      ? ""
      : d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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

  // 더 보기: 10개씩
  const showMore = async () => {
    // 로컬에 남아 있는 항목으로도 10개 확장 가능하면 fetch 없이 처리
    if (pageList.length >= visibleCount + STEP) {
      setVisibleCount(c => c + STEP);
      return;
    }

    // 더 받아와야 하는 경우
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = new URL("/api/activities", location.origin);
      url.searchParams.set("limit", String(INITIAL_LIMIT));
      if (nextCursor) url.searchParams.set("cursor", nextCursor);

      const res = await fetch(url).then(r => r.json());
      if (!res?.ok) throw new Error(res?.error || "더보기에 실패했습니다.");

      // 새로 받은 것 append
      setPageList(prev => {
        const appended = [...prev, ...(res.list || [])];
        return appended;
      });
      setNextCursor(res.nextCursor || null);
      setHasMore(!!res.hasMore);

      // 총 보이는 개수 10개 늘리기 (받아온 게 부족해도 최대치로)
      setVisibleCount(c => Math.min(c + STEP, (res.list?.length ?? 0) + pageList.length));
    } catch (e) {
      setErr(e.message || "오류가 발생했습니다.");
    } finally {
      setLoadingMore(false);
    }
  };

  // 처음으로: 캐시 복원 + 표시 개수 3개로 리셋
  const backToTop = () => {
    setPageList(firstPage.list || []);
    setNextCursor(firstPage.nextCursor || null);
    setHasMore(!!firstPage.hasMore);
    setVisibleCount(INITIAL_VISIBLE);

    const el = document.getElementById("recent-acts");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 버튼 노출 조건
  const allVisible = visibleCount >= pageList.length && !hasMore;

  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D]">
      {/* 상단 인사 & 액션 */}
      <div className="max-w-3xl mx-auto px-6 pt-7 pb-2 flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">마을시간은행</h1>
        <div className="flex gap-2">
          <Link
            href="/scan"
            className="rounded-xl px-4 py-2 bg-[#2843D1] text-white font-semibold shadow-sm hover:opacity-95"
          >
            부스 입력
          </Link>
        </div>
      </div>

      {/* 총합 카드 */}
      <section className="max-w-3xl mx-auto px-6 mt-2">
        <TotalCard
          total={summary.total}
          earn={summary.byKind?.earn}
          redeem={summary.byKind?.redeem}
        />
      </section>

      {/* 활동자산 레이더 */}
      <section className="max-w-3xl mx-auto px-6 mt-6">
        <div className="rounded-3xl bg-white ring-1 ring-[#A1E1A4]/30 p-5 shadow-sm">
          <div className="font-semibold mb-4">활동자산</div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" tickFormatter={(d) => KR[d] || d} />
                <PolarRadiusAxis />
                <Radar dataKey="total" stroke="#2843D1" fill="#27A36D" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 최근 활동 */}
      <section id="recent-acts" className="max-w-3xl mx-auto px-6 mt-6 mb-10">
        <div className="rounded-3xl bg-white ring-1 ring-[#2843D1]/15 p-5 shadow-sm">
          <div className="font-semibold mb-2">최근 활동</div>
          {(visibleList.length === 0) ? (
            <div className="text-[#94A3B8] text-sm">활동이 아직 없습니다.</div>
          ) : (
            <>
              <ul className="divide-y divide-[#E2E8F0]">
                {visibleList.map((a) => (
                  <ActivityItem
                    key={a.id ?? `${a.booth_id ?? 'booth'}-${a.created_at}`}
                    a={a}
                  />
                ))}
              </ul>

              <div className="mt-4 flex justify-center">
                {!allVisible ? (
                  <button
                    type="button"
                    onClick={showMore}
                    disabled={loadingMore}
                    className="px-4 py-2 rounded-xl bg-white ring-1 ring-[#2843D1]/30 text-[#2843D1] font-semibold hover:bg-[#2843D1]/5"
                  >
                    {loadingMore ? "불러오는 중…" : "더 보기 "}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={backToTop}
                    className="px-4 py-2 rounded-xl bg-white ring-1 ring-[#2843D1]/30 text-[#2843D1] font-semibold hover:bg-[#2843D1]/5"
                  >
                    처음으로
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
