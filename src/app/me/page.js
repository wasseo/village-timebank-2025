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
  const [pageList, setPageList] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userName, setUserName] = useState("");
  const [firstPage, setFirstPage] = useState({ list: [], nextCursor: null, hasMore: true });
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
        setUserName(me?.user?.user_metadata?.name || me?.profile?.name || "");
        const url = new URL("/api/activities", location.origin);
        url.searchParams.set("limit", String(INITIAL_LIMIT));
        const acts = await fetch(url).then(r => r.json());
        if (!acts?.ok) throw new Error(acts?.error || "활동을 불러오지 못했습니다.");

        setSummary(acts.summary || {});
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

  const radarData = useMemo(() => ([
    { domain: "environment", total: summary.byCategory?.environment || 0 },
    { domain: "social", total: summary.byCategory?.social || 0 },
    { domain: "mental", total: summary.byCategory?.mental || 0 },
    { domain: "economic", total: summary.byCategory?.economic || 0 },
  ]), [summary.byCategory]);

  if (loading) return <main className="min-h-screen bg-[#FFF7E3] p-6">불러오는 중…</main>;
  if (err) return <main className="min-h-screen bg-[#FFF7E3] p-6 text-red-600">에러: {err}</main>;

  const fmtPlus = (n) => `+${Number(n || 0)}`;

  const TotalCard = ({ total, earn, redeem }) => (
    <div className="rounded-2xl bg-white ring-1 ring-[#8F8AE6]/30 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex w-7 h-7 rounded-full items-center justify-center bg-[#8F8AE6]/10">
          <span className="text-sm text-[#8F8AE6]">●</span>
        </span>
        <div className="text-base font-semibold text-[#223D8F]">마음포인트</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-4xl font-extrabold text-[#1F2C5D] leading-tight">{Number(total || 0)}</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2843D1]/10">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2843D1]" />
            <span className="text-[#1F2C5D] font-medium">적립</span>
            <span className="text-[#1F2C5D] font-semibold">{Number(earn || 0)}</span>
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#27A36D]/10">
            <span className="w-2.5 h-2.5 rounded-full bg-[#27A36D]" />
            <span className="text-[#1F2C5D] font-medium">교환</span>
            <span className="text-[#1F2C5D] font-semibold">{Number(redeem || 0)}</span>
          </span>
        </div>
      </div>
    </div>
  );

  const ActivityItem = ({ a }) => {
    const boothName = a?.booths?.name ?? a?.booth_name ?? a?.booth_id;
    const d = new Date(a.created_at);
    const when = isNaN(+d) ? "" : d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const kindLabel = a.kind === "redeem" ? "교환" : "적립";

    return (
      <li className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#2843D1]/5 transition">
        <div className="text-sm">
          <div className="font-medium text-[#1F2C5D]">
            {boothName} <span className="text-[#64748B]">· {kindLabel}</span>
          </div>
        </div>
        <div className="font-mono text-[#27A36D]">{fmtPlus(a.amount)}</div>
      </li>
    );
  };

  const showMore = async () => {
    if (pageList.length >= visibleCount + STEP) {
      setVisibleCount(c => c + STEP);
      return;
    }
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = new URL("/api/activities", location.origin);
      url.searchParams.set("limit", String(INITIAL_LIMIT));
      if (nextCursor) url.searchParams.set("cursor", nextCursor);
      const res = await fetch(url).then(r => r.json());
      if (!res?.ok) throw new Error(res?.error || "더보기에 실패했습니다.");
      setPageList(prev => [...prev, ...(res.list || [])]);
      setNextCursor(res.nextCursor || null);
      setHasMore(!!res.hasMore);
      setVisibleCount(c => Math.min(c + STEP, (res.list?.length ?? 0) + pageList.length));
    } catch (e) {
      setErr(e.message || "오류가 발생했습니다.");
    } finally {
      setLoadingMore(false);
    }
  };

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
      <div className="max-w-3xl mx-auto px-6 pt-4 pb-1 flex items-center justify-between">
        <h1 className="text-[24px] font-extrabold tracking-tight">마을시간은행</h1>
        <Link href="/scan" className="rounded-xl px-3 py-1.5 bg-[#2843D1] text-white font-semibold shadow-sm hover:opacity-95">부스 입력</Link>
      </div>

      <section className="max-w-3xl mx-auto px-6 mt-2">
        <TotalCard total={summary.total} earn={summary.byKind?.earn} redeem={summary.byKind?.redeem} />
      </section>

      <section className="max-w-3xl mx-auto px-6 mt-3">
        <div className="rounded-3xl bg-white ring-1 ring-[#A1E1A4]/30 p-3 shadow-sm">
          <div className="font-semibold mb-2">활동자산</div>
          <div style={{ width: "100%", height: 160 }}>
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

      <section id="recent-acts" className="max-w-3xl mx-auto px-6 mt-3 mb-10">
        <div className="rounded-3xl bg-white ring-1 ring-[#2843D1]/15 p-4 shadow-sm">
          <div className="font-semibold mb-2">최근 활동</div>
          {visibleList.length === 0 ? (
            <div className="text-[#94A3B8] text-sm">활동이 아직 없습니다.</div>
          ) : (
            <>
              <ul className="divide-y divide-[#E2E8F0]">
                {visibleList.map((a) => (
                  <ActivityItem key={a.id ?? `${a.booth_id ?? 'booth'}-${a.created_at}`} a={a} />
                ))}
              </ul>
              <div className="mt-3 flex justify-center">
                {!allVisible ? (
                  <button onClick={showMore} disabled={loadingMore}
                    className="px-4 py-2 rounded-xl bg-white ring-1 ring-[#2843D1]/30 text-[#2843D1] font-semibold hover:bg-[#2843D1]/5">
                    {loadingMore ? "불러오는 중…" : "더 보기"}
                  </button>
                ) : (
                  <button onClick={backToTop}
                    className="px-4 py-2 rounded-xl bg-white ring-1 ring-[#2843D1]/30 text-[#2843D1] font-semibold hover:bg-[#2843D1]/5">
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
