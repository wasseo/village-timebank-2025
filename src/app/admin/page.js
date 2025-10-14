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
  const [range, setRange] = useState("day1");
  const [seriesMode, setSeriesMode] = useState("hour");

  // ---- 공용 ----
  const fetchMetrics = async (curRange) => {
    const j = await fetch(`/api/admin/metrics?range=${curRange}`).then(r => r.json());
    if (!j.ok) throw new Error(j.error || "metrics failed");
    return j;
  };

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!meRes?.user?.id) {
          const next = encodeURIComponent("/admin");
          location.href = `/login?next=${next}`;
          return;
        }
        const adminCsv = (process.env.NEXT_PUBLIC_ADMIN_UIDS || "")
          .split(",").map(s => s.trim()).filter(Boolean);
        if (adminCsv.length && !adminCsv.includes(meRes.user.id)) {
          setErr("접근 권한이 없습니다."); setLoading(false); return;
        }
        const j = await fetchMetrics(range);
        console.log("metrics response:", j);
        setData(j);
      } catch (e) {
        setErr(e.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  useEffect(() => {
    const itv = setInterval(async () => {
      try { setData(await fetchMetrics(range)); } catch {}
    }, 60_000);
    return () => clearInterval(itv);
  }, [range]);

  // ---- 데이터 ----
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
    totalEarnSum,
    totalRedeemSum,
    byKind = {},
  } = data || {};

  // 칩 값 폴백
  const earnVal   = (typeof totalEarnSum   === "number" ? totalEarnSum   : byKind.earn)   ?? 0;
  const redeemVal = (typeof totalRedeemSum === "number" ? totalRedeemSum : byKind.redeem) ?? 0;

  // ---- 시간 라벨: 08:00~19:00 고정 ----
  const HOUR_LABELS = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(8 + i).padStart(2, "0") + ":00"),
    []
  );

  // 값 키 자동 선택(total/sum/count/value 중 존재하는 것)
  const pickNumeric = (obj) => {
    for (const k of ["total", "sum", "count", "value"]) {
      const v = Number(obj?.[k]);
      if (!Number.isNaN(v)) return v;
    }
    return 0;
  };

  // "hour" 필드가 어떤 형태로 와도 "HH:00"로 정규화 후, 지정된 라벨만 필터
  const hourlyNormalized = useMemo(() => {
    return (hourlySeries || [])
      .map(d => {
        const raw = String(d?.hour ?? "");
        // 이미 "HH:00"이면 그대로, "8", "08", "08시" 등은 숫자만 뽑아 "HH:00"로 변환
        const hh = raw.includes(":")
          ? raw.slice(0, 5) // "08:00"
          : String(Number(raw.replace(/\D/g, ""))).padStart(2, "0") + ":00";
        return { ...d, hourStr: hh, value: pickNumeric(d) };
      })
      .filter(d => HOUR_LABELS.includes(d.hourStr));
  }, [hourlySeries, HOUR_LABELS]);

  // 일자 시리즈도 value 키로 정규화
  const timeSeriesNormalized = useMemo(
    () => (timeSeries || []).map(d => ({ ...d, value: pickNumeric(d) })),
    [timeSeries]
  );

  const series = seriesMode === "hour" ? hourlyNormalized : timeSeriesNormalized;
  const xKey   = seriesMode === "hour" ? "hourStr" : "day";

  const KR = { environment: "환경", social: "사회", economic: "경제", mental: "정신" };

  const maskName = (raw) => {
    if (!raw) return "익명";
    if (/^[0-9a-f-]{20,}$/i.test(raw)) return `사용자(${String(raw).slice(0, 6)})`;
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

  // ---- UI ----
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
          <span>{i + 1}. {maskName(x.name)} / {last4(x.phone)}</span>
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

  // 총합 카드 (한 줄 배치 + 색감/칩)
  const TotalCard = ({ total, earn, redeem }) => (
    <div className="rounded-2xl bg-white ring-1 ring-[#8F8AE6]/30 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-nowrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-7 h-7 rounded-full items-center justify-center bg-[#8F8AE6]/10">
            <span className="text-sm text-[#8F8AE6]">●</span>
          </span>
          <div className="text-base font-semibold text-[#223D8F]">마음포인트</div>
        </div>
        <div className="text-5xl font-extrabold text-[#1F2C5D] leading-tight shrink-0">
          {Number(total || 0)}
        </div>
        <div className="flex items-center gap-2 text-sm shrink-0">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
                style={{ backgroundColor: "rgba(40,67,209,0.18)" }}>
            <span className="relative w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "#2843D1", boxShadow: "0 0 6px 2px rgba(40,67,209,0.35)" }} />
            <span className="text-[#1F2C5D] font-medium">적립</span>
            <span className="text-[#1F2C5D] font-semibold">{Number(earn || 0)}</span>
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
                style={{ backgroundColor: "rgba(39,163,109,0.18)" }}>
            <span className="relative w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "#27A36D", boxShadow: "0 0 6px 2px rgba(39,163,109,0.35)" }} />
            <span className="text-[#1F2C5D] font-medium">교환</span>
            <span className="text-[#1F2C5D] font-semibold">{Number(redeem || 0)}</span>
          </span>
        </div>
      </div>
    </div>
  );

  // ---- 렌더 ----
  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D]">
      {loading ? (
        <div className="p-6">불러오는 중…</div>
      ) : err ? (
        <div className="p-6 text-red-600">에러: {err}</div>
      ) : (
        <div className="mx-auto px-8 py-6" style={{ maxWidth: 1920 }}>
          {/* 헤더 */}
          <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
            <h1 className="text-[36px] font-extrabold tracking-tight">2025 경기마을주간행사 마음자산</h1>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => setRange("day1")}
                className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                  range === "day1" ? "bg-[#2843D1] text-white ring-[#2843D1]"
                                   : "text-[#2843D1] ring-[#2843D1]/50 hover:bg-[#2843D1]/10"}`}>
                10/18
              </button>
              <button onClick={() => setRange("day2")}
                className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                  range === "day2" ? "bg-[#27A36D] text-white ring-[#27A36D]"
                                   : "text-[#27A36D] ring-[#27A36D]/50 hover:bg-[#27A36D]/10"}`}>
                10/19
              </button>
              <div className="w-px h-6 bg-[#CBD5E1]" />
              <button onClick={() => setSeriesMode("hour")}
                className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                  seriesMode === "hour" ? "bg-[#2843D1] text-white ring-[#2843D1]"
                                        : "text-[#2843D1] ring-[#2843D1]/50 hover:bg-[#2843D1]/10"}`}>
                시간대별
              </button>
              <button onClick={() => setSeriesMode("day")}
                className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${
                  seriesMode === "day" ? "bg-[#27A36D] text-white ring-[#27A36D]"
                                       : "text-[#27A36D] ring-[#27A36D]/50 hover:bg-[#27A36D]/10"}`}>
                일자별
              </button>
            </div>
          </div>

          {/* 총합 카드 */}
          <section className="mb-4">
            <TotalCard total={totalSum} earn={earnVal} redeem={redeemVal} />
          </section>

          {/* Top3 */}
          <section className="grid grid-cols-5 gap-4 mb-4">
            <Card title={`Top3 총합(개인)`}><RankList items={topUsersOverall} /></Card>
            <Card title={`Top3 적립(개인)`}><RankList items={topUsersEarn} /></Card>
            <Card title={`Top3 교환(개인)`}><RankList items={topUsersRedeem} /></Card>
            <Card title={`Top3 적립(부스)`}><RankListBooth items={topBoothsEarn} /></Card>
            <Card title={`Top3 교환(부스)`}><RankListBooth items={topBoothsRedeem} /></Card>
          </section>

          {/* 그래프 + 레이더 */}
          <section className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Card title={`전체 포인트 그래프`}>
                {series.length === 0 ? (
                  <div className="text-[#94A3B8] p-4">표시할 데이터가 없습니다</div>
                ) : (
                  <div style={{ width: "100%", height: 380 }}>
                    <ResponsiveContainer>
                      <LineChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                        <XAxis
                          dataKey={xKey}
                          stroke="#1F2C5D"
                          ticks={seriesMode === "hour" ? HOUR_LABELS : undefined}
                          tickFormatter={(v) => v}
                        />
                        <YAxis stroke="#1F2C5D" allowDecimals={false} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"  // total/sum/count 중 자동 매핑된 값
                          stroke="#2843D1"
                          strokeWidth={3}
                          dot={{ fill: "#27A36D" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

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
      )}
    </main>
  );
}
