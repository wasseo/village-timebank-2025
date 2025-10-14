// src/app/admin/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState("day1");          // 10/18, 10/19
  const [seriesMode, setSeriesMode] = useState("hour"); // "hour" | "day"

  // ---------- 공용 fetch 함수 ----------
  const fetchMetrics = async (curRange) => {
    const j = await fetch(`/api/admin/metrics?range=${curRange}`).then(r => r.json());
    if (!j.ok) throw new Error(j.error || "metrics failed");
    return j;
  };

  // ---------- 최초 로드 + range 변경 시 로드 ----------
  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!meRes?.user?.id) {
          const next = encodeURIComponent("/admin");
          location.href = `/login?next=${next}`;
          return;
        }

        // 관리자 화이트리스트 체크
        const adminCsv = (process.env.NEXT_PUBLIC_ADMIN_UIDS || "")
          .split(",").map(s => s.trim()).filter(Boolean);
        if (adminCsv.length && !adminCsv.includes(meRes.user.id)) {
          setErr("접근 권한이 없습니다.");
          setLoading(false);
          return;
        }

        const j = await fetchMetrics(range);
        setData(j);
      } catch (e) {
        setErr(e.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  // ---------- 1분 자동 갱신 (자동 순환 없음) ----------
  useEffect(() => {
    const itv = setInterval(async () => {
      try {
        const j = await fetchMetrics(range);
        setData(j);
      } catch (e) {
        // 조용히 무시(네트워크 순간 오류 등)
        console.warn("[admin refresh] fetch failed:", e?.message || e);
      }
    }, 60_000); // 1분
    return () => clearInterval(itv);
  }, [range]);

  if (loading) return <main className="min-h-screen bg-[#FFF7E3] p-6">불러오는 중…</main>;
  if (err) return <main className="min-h-screen bg-[#FFF7E3] p-6 text-red-600">에러: {err}</main>;

  const {
    totalSum = 0,
    timeSeries = [],
    hourlySeries = [],
    topUsersOverall = [],
    topUsersEarn = [],
    topUsersRedeem = [],
    topBoothsEarn = [],
    topBoothsRedeem = [],
    domainTotals = [],
    // (있을 수 있는 필드 – 있으면 총합 카드에 칩으로 노출)
    totalEarnSum,
    totalRedeemSum,
  } = data || {};

  const KR = { environment: "환경", social: "사회", economic: "경제", mental: "정신" };
  const rangeLabel = range === "day1" ? "10/18" : "10/19";

  const maskName = (raw) => {
    if (!raw) return "익명";
    if (/^[0-9a-f-]{20,}$/i.test(raw)) return `사용자(${raw.slice(0, 6)})`;
    const s = String(raw);
    if (s.length <= 1) return s;
    if (s.length === 2) return s[0] + "*";
    return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
  };
  const last4 = (p) => {
    if (!p) return "-";
    const d = String(p).replace(/\D/g, "");
    return d.length >= 4 ? d.slice(-4) : "-";
  };
  const rankLabel = (x) => `${maskName(x.name)} / ${last4(x.phone)}`;

  const Card = ({ title, children }) => (
    <div className="rounded-2xl bg-white ring-1 ring-[#E2E8F0] p-5 shadow-sm h-full">
      <div className="font-semibold mb-2 text-[#1F2C5D]">{title}</div>
      {children}
    </div>
  );

  const RankList = ({ items }) => (
    <ol className="space-y-1 text-[#1F2C5D]">
      {items.map((x, i) => (
        <li key={i} className="flex justify-between">
          <span>{i + 1}. {rankLabel(x)}</span>
          <span className="font-mono text-[#27A36D]">+{x.total}</span>
        </li>
      ))}
      {items.length === 0 && <li className="text-[#94A3B8]">데이터 없음</li>}
    </ol>
  );

  const RankListBooth = ({ items }) => (
    <ol className="space-y-1 text-[#1F2C5D]">
      {items.map((x, i) => (
        <li key={i} className="flex justify-between">
          <span>{i + 1}. {x.name || x.id}</span>
          <span className="font-mono text-[#27A36D]">+{x.total}</span>
        </li>
      ))}
      {items.length === 0 && <li className="text-[#94A3B8]">데이터 없음</li>}
    </ol>
  );

 // 총합 카드 (TV/모바일 반응형, 숫자 강조, 칩 색 조정)
  const TotalCard = ({ total, earnSum, redeemSum }) => (
    <div className="rounded-2xl bg-white ring-1 ring-[#8F8AE6]/30 p-5 shadow-sm">
      {/* 모바일=세로 / 데스크톱=가로 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* 좌: 아이콘 + 타이틀 */}
        <div className="flex items-center gap-3">
          <span className="inline-flex w-10 h-10 rounded-full items-center justify-center bg-[#8F8AE6]/10">
            <span className="text-xl text-[#8F8AE6]">●</span>
          </span>
          <div className="text-xl md:text-2xl font-bold text-[#223D8F]">마음포인트</div>
        </div>

        {/* 중: 총합 숫자(크고 두껍게) */}
        <div className="text-5xl md:text-6xl font-black text-[#1F2C5D] leading-none">
          +{Number(total || 0)}
        </div>

        {/* 우: 칩 요약 (적립=파랑, 교환=오렌지) */}
        <div className="flex flex-wrap items-center gap-3">
          {typeof earnSum === "number" && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2843D1]/10">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#2843D1" }} />
              <span className="text-[#1F2C5D] font-medium">적립</span>
              <span className="text-[#1F2C5D] font-semibold">+{Number(earnSum || 0)}</span>
            </span>
          )}
          {typeof redeemSum === "number" && (
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "rgb(251 146 60 / 0.15)" }} // #FB923C 15%
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EA580C" }} />
              <span className="text-[#1F2C5D] font-medium">교환</span>
              <span className="text-[#1F2C5D] font-semibold">+{Number(redeemSum || 0)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // ---------- 차트 데이터 ----------
  const series = seriesMode === "hour" ? hourlySeries : timeSeries;
  const xKey    = seriesMode === "hour" ? "hour" : "day";
  const titleTs = seriesMode === "hour" ? "시간대별(KST)" : "일자별";

  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D]">
      {/* 전체 폭을 TV 해상도에 가깝게 (1920px) */}
      <div className="mx-auto px-8 py-6" style={{ maxWidth: 1920 }}>
        {/* 헤더 (고정 높이 느낌) */}
        <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
          <h1 className="text-[36px] font-extrabold tracking-tight">2025 경기마을주간행사 마음자산</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setRange("day1")}
              className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                range === "day1"
                  ? "bg-[#2843D1] text-white ring-[#2843D1]"
                  : "text-[#2843D1] ring-[#2843D1]/50 hover:bg-[#2843D1]/10"
              }`}
            >
              10/18
            </button>
            <button
              onClick={() => setRange("day2")}
              className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                range === "day2"
                  ? "bg-[#27A36D] text-white ring-[#27A36D]"
                  : "text-[#27A36D] ring-[#27A36D]/50 hover:bg-[#27A36D]/10"
              }`}
            >
              10/19
            </button>
            <div className="w-px h-6 bg-[#CBD5E1]" />
            <button
              onClick={() => setSeriesMode("hour")}
              className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                seriesMode === "hour"
                  ? "bg-[#2843D1] text-white ring-[#2843D1]"
                  : "text-[#2843D1] ring-[#2843D1]/50 hover:bg-[#2843D1]/10"
              }`}
            >
              시간대별
            </button>
            <button
              onClick={() => setSeriesMode("day")}
              className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                seriesMode === "day"
                  ? "bg-[#27A36D] text-white ring-[#27A36D]"
                  : "text-[#27A36D] ring-[#27A36D]/50 hover:bg-[#27A36D]/10"
              }`}
            >
              일자별
            </button>
          </div>
        </div>

        {/* 총합 카드 (풀폭, 약 140~160px 높이 감) */}
        <section className="mb-4">
          <TotalCard total={totalSum} earnSum={totalEarnSum} redeemSum={totalRedeemSum} />
        </section>

        {/* Top3 5개 (가로 일렬) */}
        <section className="grid grid-cols-5 gap-4 mb-4">
          <Card title={`Top3 총합(개인)`}>
            <RankList items={topUsersOverall} />
          </Card>
          <Card title={`Top3 적립(개인)`}>
            <RankList items={topUsersEarn} />
          </Card>
          <Card title={`Top3 교환(개인)`}>
            <RankList items={topUsersRedeem} />
          </Card>
          <Card title={`Top3 적립(부스)}`}>
            <RankListBooth items={topBoothsEarn} />
          </Card>
          <Card title={`Top3 교환(부스)`}>
            <RankListBooth items={topBoothsRedeem} />
          </Card>
        </section>

        {/* 하단 2분할: 좌(그래프 2) : 우(레이더 1) */}
        <section className="grid grid-cols-3 gap-4">
          {/* 좌측 그래프 (col-span 2) */}
          <div className="col-span-2">
            <Card title={`전체 포인트 그래프`}>  
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                    <XAxis dataKey={xKey} stroke="#1F2C5D" />
                    <YAxis stroke="#1F2C5D" allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#2843D1" strokeWidth={3} dot={{ fill: "#27A36D" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* 우측 레이더 */}
          <div className="col-span-1">
            <Card title={`활동자산 `}>
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <RadarChart data={domainTotals}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="domain" tickFormatter={(d) => KR[d] || d} />
                    <PolarRadiusAxis />
                    <Radar dataKey="total" stroke="#2843D1" fill="#27A36D" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
