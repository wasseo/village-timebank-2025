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

  // ----- 칩 컴포넌트 (dot만 glow + 버튼톤 배경) -----
  const Chip = ({ bg, dot, label, value }) => (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
      style={{ backgroundColor: bg }}
    >
      {/* dot + halo */}
      <span
        className="relative w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: dot, boxShadow: `0 0 6px 2px ${dot}59` /* 35% */ }}
      />
      <span className="text-[#1F2C5D] font-medium">{label}</span>
      <span className="text-[#1F2C5D] font-semibold">+{Number(value || 0)}</span>
    </span>
  );

    // 총합 카드 (포스터 색감 반영 버전)
  const TotalCard = ({ total, earn, redeem }) => (
    <div className="rounded-2xl bg-white ring-1 ring-[#8F8AE6]/30 p-5 shadow-sm">
      {/* 상단 타이틀 */}
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex w-7 h-7 rounded-full items-center justify-center bg-[#8F8AE6]/10">
          <span className="text-sm text-[#8F8AE6]">●</span>
        </span>
        <div className="text-base font-semibold text-[#223D8F]">마음포인트</div>
      </div>

      {/* 숫자 + 칩 한 줄 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 총합 숫자 */}
        <div className="text-5xl font-extrabold text-[#1F2C5D] leading-tight">
          {Number(total || 0)}
        </div>

        {/* 칩 그룹 */}
        <div className="flex items-center gap-2 text-sm">
          {/* 적립(파랑) */}
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
            style={{ backgroundColor: "rgba(40,67,209,0.18)" }} // 파랑 배경 18%
          >
            {/* dot + halo */}
            <span
              className="relative w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: "#2843D1",
                boxShadow: "0 0 6px 2px rgba(40,67,209,0.35)", // dot halo
              }}
            />
            <span className="text-[#1F2C5D] font-medium">적립</span>
            <span className="text-[#1F2C5D] font-semibold">{Number(earn || 0)}</span>
          </span>

          {/* 교환(초록) */}
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
            style={{ backgroundColor: "rgba(39,163,109,0.18)" }} // 초록 배경 18%
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
    </div>
  );


  // ---------- 차트 데이터 ----------
  // 08~19시만 필터링 (시작/종료 포함)
  const filteredHourly = useMemo(() => {
    return (hourlySeries || []).filter(d => {
      const h = Number(d?.hour);
      return !Number.isNaN(h) && h >= 8 && h <= 19;
    });
  }, [hourlySeries]);

  const series = seriesMode === "hour" ? filteredHourly : timeSeries;
  const xKey    = seriesMode === "hour" ? "hour" : "day";
  const hourTicks = useMemo(() => Array.from({ length: 12 }, (_, i) => 8 + i), []); // 8..19

  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D]">
      <div className="mx-auto px-8 py-6" style={{ maxWidth: 1920 }}>
        {/* 헤더 */}
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

        {/* 총합 카드 */}
        <section className="mb-4">
          <TotalCard total={totalSum} earn={totalEarnSum} redeem={totalRedeemSum} />
        </section>

        {/* Top3 5개 */}
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
          <Card title={`Top3 적립(부스)`}>
            <RankListBooth items={topBoothsEarn} />
          </Card>
          <Card title={`Top3 교환(부스)`}>
            <RankListBooth items={topBoothsRedeem} />
          </Card>
        </section>

        {/* 하단 2분할 */}
        <section className="grid grid-cols-3 gap-4">
          {/* 좌측 그래프 */}
          <div className="col-span-2">
            <Card title={`전체 포인트 그래프`}>
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                    <XAxis
                      dataKey={xKey}
                      stroke="#1F2C5D"
                      ticks={seriesMode === "hour" ? hourTicks : undefined}
                      tickFormatter={(v) =>
                        seriesMode === "hour" ? String(v).padStart(2, "0") + "시" : v
                      }
                    />
                    <YAxis stroke="#1F2C5D" allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2843D1"
                      strokeWidth={3}
                      dot={{ fill: "#27A36D" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* 우측 레이더 */}
          <div className="col-span-1">
            <Card title={`활동자산`}>
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