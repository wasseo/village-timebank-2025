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
  const [range, setRange] = useState("day1");     // "day1" | "day2"
  const [seriesMode, setSeriesMode] = useState("hour"); // "hour" | "day"

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

  if (loading) return <main className="p-6">불러오는 중…</main>;
  if (err) return <main className="p-6 text-red-400">에러: {err}</main>;

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
    if (/^[0-9a-f-]{20,}$/i.test(raw)) return `사용자(${raw.slice(0,8)})`;
    const s = String(raw);
    if (s.length <= 1) return s;
    if (s.length === 2) return s[0] + "*";
    return s[0] + "*".repeat(Math.max(1, s.length - 2)) + s[s.length - 1];
  };
  const last4 = (p) => {
    if (!p) return "-";
    const d = String(p).replace(/\D/g, "");
    return d.length >= 4 ? d.slice(-4) : "-";
  };
  const rankLabel = (x) => `${maskName(x.name)} / ${last4(x.phone)}`;

  const Card = ({ title, children }) => (
    <div className="rounded-2xl border p-5">
      <div className="font-semibold mb-2">{title}</div>
      {children}
    </div>
  );

  const RankList = ({ items }) => (
    <ol className="space-y-1">
      {items.map((x, i) => (
        <li key={i} className="flex justify-between">
          <span>{i + 1}. {rankLabel(x)}</span>
          <span className="font-mono">+{x.total}</span>
        </li>
      ))}
      {items.length === 0 && <li className="text-gray-500">데이터 없음</li>}
    </ol>
  );

  // 부스 전용: 전체 이름 표시(마스킹/전화번호 표시 X)
  const RankListBooth = ({ items }) => (
    <ol className="space-y-1">
      {items.map((x, i) => (
        <li key={i} className="flex justify-between">
          <span>{i + 1}. {x.name || x.id}</span>
          <span className="font-mono">+{x.total}</span>
        </li>
      ))}
      {items.length === 0 && <li className="text-gray-500">데이터 없음</li>}
    </ol>
  );

  const rangeLabel = range === "day1" ? "테스트~10/18" : "10/19~";

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">운영자 대시보드</h1>
          <span className="text-sm border rounded px-2 py-1">총합: +{totalSum}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`border rounded px-3 py-2 ${range==="day1" ? "bg-white/10" : ""}`}
            onClick={() => setRange("day1")}
            title="테스트기간 ~ 10/18"
          >
            ① 테스트~10/18
          </button>
          <button
            className={`border rounded px-3 py-2 ${range==="day2" ? "bg-white/10" : ""}`}
            onClick={() => setRange("day2")}
            title="10/19 ~"
          >
            ② 10/19~
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <button
            className={`border rounded px-3 py-2 ${seriesMode==="hour" ? "bg-white/10" : ""}`}
            onClick={() => setSeriesMode("hour")}
            title="시간대별"
          >
            시간대별
          </button>
          <button
            className={`border rounded px-3 py-2 ${seriesMode==="day" ? "bg-white/10" : ""}`}
            onClick={() => setSeriesMode("day")}
            title="일자별"
          >
            일자별
          </button>
        </div>
      </div>

      {/* 0. 전체 활동포인트 – 시간대별/일자별 라인차트 */}
      <Card title={`전체 활동 포인트 · ${seriesMode==="hour" ? "시간대별(KST)" : "일자별"} · ${rangeLabel}`}>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={seriesMode==="hour" ? hourlySeries : timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={seriesMode==="hour" ? "hour" : "day"} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 랭킹 4개 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title={`총 활동이 많은 사람 Top3 · ${rangeLabel}`}>
          <RankList items={topUsersOverall} />
        </Card>
        <Card title={`적립(Earn)이 많은 사람 Top3 · ${rangeLabel}`}>
          <RankList items={topUsersEarn} />
        </Card>
        <Card title={`교환(Redeem)이 많은 사람 Top3 · ${rangeLabel}`}>
          <RankList items={topUsersRedeem} />
        </Card>

        {/* ✅ 부스 Top3를 각각 큰 카드로 분리 + 이름 전체 표시 */}
        <Card title={`적립이 많은 부스 Top3 · ${rangeLabel}`}>
          <RankListBooth items={topBoothsEarn} />
        </Card>
        <Card title={`교환이 많은 부스 Top3 · ${rangeLabel}`}>
          <RankListBooth items={topBoothsRedeem} />
        </Card>
      </div>

      {/* 6. 분야 합계 – 방사형 차트 */}
      <Card title={`2025경기마을공동체 활동자산 · ${rangeLabel}`}>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <RadarChart data={domainTotals}>
              <PolarGrid />
              <PolarAngleAxis dataKey="domain" tickFormatter={(d) => KR[d] || d} />
              <PolarRadiusAxis />
              <Radar dataKey="total" />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </main>
  );
}
