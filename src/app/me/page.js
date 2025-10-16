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

  // 페이징 상태
  const [pageList, setPageList] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [firstPage, setFirstPage] = useState({ list: [], nextCursor: null, hasMore: true });

  // 표시 개수: 최초 2개, 이후 10개씩 증가
  const INITIAL_VISIBLE = 2;
  const STEP = 10;
  const INITIAL_LIMIT = 10;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const visibleList = useMemo(() => pageList.slice(0, visibleCount), [pageList, visibleCount]);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          const next = encodeURIComponent("/me");
          location.href = `/login?next=${next}`;
          return;
        }

        // 활동 첫 페이지 + 요약
        const url = new URL("/api/activities", location.origin);
        url.searchParams.set("limit", String(INITIAL_LIMIT));
        const acts = await fetch(url).then(r => r.json());
        if (!acts?.ok) throw new Error(acts?.error || "활동을 불러오지 못했습니다.");

        setSummary(acts.summary || { total: 0, byKind: { earn: 0, redeem: 0 }, byCategory: {} });
        const list = Array.isArray(acts.list) ? acts.list : [];
        setPageList(list);
        setNextCursor(acts.nextCursor || null);
        setHasMore(!!acts.hasMore);
        setFirstPage({ list, nextCursor: acts.nextCursor || null, hasMore: !!acts.hasMore });
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
  const radarData = useMemo(() => ([
    { domain: "environment", total: summary.byCategory?.environment || 0 },
    { domain: "social", total: summary.byCategory?.social || 0 },
    { domain: "mental", total: summary.byCategory?.mental || 0 },
    { domain: "economic", total: summary.byCategory?.economic || 0 },
  ]), [summary.byCategory]);

  if (loading) return <main className="min-h-screen bg-[#FFF7E3] p-6">불러오는 중…</main>;
  if (err) return <main className="min-h-screen bg-[#FFF7E3] p-6 text-red-600">에러: {err}</main>;

  const fmtPlus = (n) => `+${Number(n || 0)}`;

  // TotalCard 컴포넌트는 변경 없음
  const TotalCard = ({ total, earn, redeem }) => {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-[#8F8AE6]/30 p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-3 items-stretch">
          {/* 💜 마음포인트: 내부 박스 없이 콘텐츠만 (col-span-2) */}
          <div className="col-span-2 flex flex-col items-center justify-center min-h-[96px]">
            <div className="flex items-center gap-2 text-sm md:text-base font-semibold text-[#223D8F]">
              {/* dot + halo */}
              <span className="relative inline-flex w-4 h-4 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full opacity-50 blur-sm"
                  style={{ backgroundColor: "#8F8AE6" }}
                />
                <span
                  className="relative w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "#8F8AE6" }}
                />
              </span>
              마음포인트
            </div>
            <div className="mt-1 text-4xl md:text-5xl font-extrabold text-[#1F2C5D] leading-tight">
              {Number(total || 0)}
            </div>
          </div>

          {/* 💙 적립 (가운데 한 줄 정렬) */}
          <div className="col-span-1 rounded-xl bg-[#2843D1]/10 ring-1 ring-[#2843D1]/20 p-3 flex items-center justify-center min-h-[88px]">
            <div className="flex flex-col items-center justify-center text-center">
              {/* 라벨 */}
              <span className="inline-flex items-center gap-1 text-sm md:text-base font-semibold text-[#2843D1]">
                <span className="relative inline-flex w-4 h-4 items-center justify-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full opacity-50 blur-sm"
                    style={{ backgroundColor: "#2843D1" }}
                  />
                  <span
                    className="relative w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: "#2843D1" }}
                  />
                </span>
                적립
              </span>
              {/* 숫자 */}
              <span className="text-3xl md:text-4xl font-extrabold text-[#1F2C5D] leading-none translate-y-[1px]">
                {Number(earn || 0)}
              </span>
            </div>
          </div>

          {/* 💚 교환 (가운데 한 줄 정렬) */}
          <div className="col-span-1 rounded-xl bg-[#27A36D]/10 ring-1 ring-[#27A36D]/20 p-3 flex items-center justify-center min-h-[88px]">
            <div className="flex flex-col items-center justify-center text-center">
              <span className="inline-flex items-center gap-1 text-sm md:text-base font-semibold text-[#27A36D]">
                <span className="relative inline-flex w-4 h-4 items-center justify-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full opacity-50 blur-sm"
                    style={{ backgroundColor: "#27A36D" }}
                  />
                  <span
                    className="relative w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: "#27A36D" }}
                  />
                </span>
                교환
              </span>
              <span className="text-3xl md:text-4xl font-extrabold text-[#1F2C5D] leading-none translate-y-[1px]">
                {Number(redeem || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ActivityItem 컴포넌트는 변경 없음
  const ActivityItem = ({ a }) => {
    const boothName = a?.booths?.name ?? a?.booth_name ?? a?.booth_id;
    const isRedeem = a.kind === "redeem";
    const kindLabel = isRedeem ? "교환" : "적립";
    const tone = isRedeem ? "#27A36D" : "#2843D1"; // 칩과 동일 색

    return (
      <li className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-[#2843D1]/5 transition">
        {/* 왼쪽: 부스명만 */}
        <div className="text-sm font-medium text-[#1F2C5D]">{boothName}</div>

        {/* 오른쪽: 종류 +1 (볼드, 우측정렬, 칼라) */}
        <div className="text-sm font-bold" style={{ color: tone }}>
          {kindLabel} {fmtPlus(a.amount)}
        </div>
      </li>
    );
  };

  // 스크롤 위치 보정 함수 (별도로 분리)
  const scrollToButton = () => {
    requestAnimationFrame(() => {
      document.getElementById("recent-acts-more")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  // '더 보기' 로직 (수정된 핵심 부분)
  const showMore = async () => {
    
    // 1. [핵심 수정] 로컬 목록을 확장할 여유가 있는지 먼저 확인합니다.
    if (visibleCount < pageList.length) {
        // 로컬 목록을 다음 스텝만큼 늘리거나, 목록 끝까지 늘립니다.
        setVisibleCount(c => Math.min(c + STEP, pageList.length));
        scrollToButton();
        return; 
    }

    // 2. 서버 요청이 필요한지 확인 (로컬 목록이 끝났고, 더 가져올 것이 남아있는 경우)
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
        const url = new URL("/api/activities", location.origin);
        url.searchParams.set("limit", String(INITIAL_LIMIT));
        if (nextCursor) url.searchParams.set("cursor", nextCursor);

        const res = await fetch(url).then(r => r.json());
        if (!res?.ok) throw new Error(res?.error || "더보기에 실패했습니다.");

        const newItems = res.list || [];

        setPageList(prev => [...prev, ...newItems]);
        setNextCursor(res.nextCursor || null);
        setHasMore(!!res.hasMore);
        
        // visibleCount를 새 항목만큼 늘립니다.
        setVisibleCount(c => c + newItems.length); 

    } catch (e) {
        setErr(e.message || "오류가 발생했습니다.");
    } finally {
        setLoadingMore(false);
        // 목록이 실제로 추가되었으므로 스크롤을 조정합니다.
        scrollToButton();
    }
  };

  // 처음으로: 첫 페이지 복원 + 상단으로 스크롤
  const backToTop = () => {
    setPageList(firstPage.list || []);
    setNextCursor(firstPage.nextCursor || null);
    setHasMore(!!firstPage.hasMore);
    setVisibleCount(INITIAL_VISIBLE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const allVisible = visibleCount >= pageList.length && !hasMore;

  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D]">
      {/* 헤더 */}
      <div className="max-w-3xl mx-auto px-6 pt-4 pb-1 flex items-center justify-between">
        <h1 className="text-[24px] font-extrabold tracking-tight">마을시간은행</h1>
        <Link
          href="/scan"
          className="rounded-xl px-3 py-1.5 bg-[#2843D1] text-white font-semibold shadow-sm hover:opacity-95"
        >
          부스 입력
        </Link>
      </div>

      {/* 총합 카드 */}
      <section className="max-w-3xl mx-auto px-6 mt-2">
        <TotalCard
          total={summary.total}
          earn={summary.byKind?.earn}
          redeem={summary.byKind?.redeem}
        />
      </section>

      {/* ✅ 최근 활동 (위로 배치) */}
      <section id="recent-acts" className="max-w-3xl mx-auto px-6 mt-3">
        <div className="rounded-3xl bg-white ring-1 ring-[#2843D1]/15 p-4 shadow-sm">
          <div className="font-semibold mb-2">최근 활동</div>

          {visibleList.length === 0 ? (
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

              {/* 더보기 / 처음으로 */}
              <div id="recent-acts-more" className="mt-3 flex justify-center">
                {!allVisible ? (
                  <button
                    onClick={showMore}
                    disabled={loadingMore}
                    className="px-3 py-1.5 rounded-lg bg-white ring-1 ring-[#2843D1]/30 
                               text-[#2843D1] text-sm font-semibold hover:bg-[#2843D1]/5"
                  >
                    {loadingMore ? "불러오는 중…" : "더 보기"}
                  </button>
                ) : (
                  <button
                    onClick={backToTop}
                    className="px-4 py-2 rounded-xl bg-white ring-1 ring-[#2843D1]/30 
                               text-[#2843D1] font-semibold hover:bg-[#2843D1]/5"
                  >
                    처음으로
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ✅ 활동자산 (아래로 이동) */}
      <section className="max-w-3xl mx-auto px-6 mt-3 mb-10">
        <div className="rounded-3xl bg-white ring-1 ring-[#A1E1A4]/30 p-3 shadow-sm">
          <div className="font-semibold mb-2">활동자산</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" tickFormatter={(d) => KR[d] || d} />
                <PolarRadiusAxis tick={false} />
                <Radar dataKey="total" stroke="#2843D1" fill="#27A36D" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </main>
  );
}