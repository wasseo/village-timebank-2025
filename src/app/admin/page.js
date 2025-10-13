// src/app/admin/page.js
"use client";

import { useEffect, useState } from "react";
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
          setErr("접근 권한이 없습니다.");
          setLoading(false);
          return;
        }

        const j = await fetch(`/api/admin/metrics?range=${range}`).then(r => r.json());
        if (!j.ok) throw new Error(j.error || "metrics failed");
        setData(j);
      } catch (e) {
        setErr(e.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
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
  } = data || {};

  const KR = { environment: "환경", social: "사회", economic: "경제", mental: "정신" };

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
    <div className="rounded-2xl bg-white ring-1 ring-[#E2E8F0] p-5 shadow-sm">
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

  const rangeLabel = range === "day1" ? "10/18" : "10/19";

  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D] px-6 py-8">
      {/* 헤더 */}
      <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">2025 경기마을주간행사 마음자산</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-3 py-1 bg-white rounded-full ring-1 ring-[#27A36D]/40 text-[#1F2C5D] font-semibold text-sm">
            총합: +{totalSum}
          </span>
          <button
            onClick={() => setRange("day1")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
              range === "day1"
                ? "bg-[#2843D1] text-white ring-[#2843D1]"
                : "text-[#2843D1] ring-[#2843D1]/50 hover:bg-[#2843D1]/10"
            }`}
          >
            10/18
          </button>
          <button
            onClick={() => setRange("day2")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
              range === "day2"
                ? "bg-[#27A36D] text-white ring-[#27A36D]"
                : "text-[#27A36D] ring-[#27A36D]/50 hover:bg-[#27A36D]/10"
            }`}
          >
            10/19
          </button>
          <div className="w-px h-5 bg-[#CBD5E1]" />
          <button
            onClick={() => setSeriesMode("hour")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
              seriesMode === "hour"
                ? "bg-[#2843D1] text-white ring-[#2843D1]"
                : "text-[#2843D1] ring-[#2843D1]/50 hover:bg-[#2843D1]/10"
            }`}
          >
            시간대별
          </button>
          <button
            onClick={() => setSeriesMode("day")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
              seriesMode === "day"
                ? "bg-[#27A36D] text-white ring-[#27A36D]"
                : "text-[#27A36D] ring-[#27A36D]/50 hover:bg-[#27A36D]/10"
            }`}
          >
            일자별
          </button>
        </div>
      </div>

      {/* 라인차트 */}
      <section className="max-w-6xl mx-auto mb-6">
        <Card title={`전체 활동 포인트 · ${seriesMode==="hour" ? "시간대별(KST)" : "일자별"} · ${rangeLabel}`}>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={seriesMode==="hour" ? hourlySeries : timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                <XAxis dataKey={seriesMode==="hour" ? "hour" : "day"} stroke="#1F2C5D" />
                <YAxis stroke="#1F2C5D" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2843D1" strokeWidth={3} dot={{ fill: "#27A36D" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Top3 영역 */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-4">
        <Card title={`총 활동이 많은 사람 Top3 · ${rangeLabel}`}>
          <RankList items={topUsersOverall} />
        </Card>
        <Card title={`적립(Earn)이 많은 사람 Top3 · ${rangeLabel}`}>
          <RankList items={topUsersEarn} />
        </Card>
        <Card title={`교환(Redeem)이 많은 사람 Top3 · ${rangeLabel}`}>
          <RankList items={topUsersRedeem} />
        </Card>
        <Card title={`적립이 많은 부스 Top3 · ${rangeLabel}`}>
          <RankListBooth items={topBoothsEarn} />
        </Card>
        <Card title={`교환이 많은 부스 Top3 · ${rangeLabel}`}>
          <RankListBooth items={topBoothsRedeem} />
        </Card>
      </section>

      {/* 방사형 차트 */}
      <section className="max-w-6xl mx-auto mt-6 mb-10">
        <Card title={`2025경기마을공동체 활동자산 · ${rangeLabel}`}>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <RadarChart data={domainTotals}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" tickFormatter={(d) => KR[d] || d} />
                <PolarRadiusAxis />
                <Radar dataKey="total" stroke="#2843D1" fill="#27A36D" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-end mt-3">
            <span className="text-sm text-[#1F2C5D]/70">경기도마을공동체지원센터</span>
          </div>
        </Card>
      </section>
    </main>
  );
}