// src/app/admin/page.js
"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

export default function AdminDashboardPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState("day1"); // day1, day2

  useEffect(() => {
    (async () => {
      try {
        // 1) 로그인 확인
        const meRes = await fetch("/api/me").then(r => r.json()).catch(() => null);
        setMe(meRes);
        if (!meRes?.user?.id) {
          const next = encodeURIComponent("/admin");
          location.href = `/login?next=${next}`;
          return;
        }

        // (선택) 간단한 어드민 제한 – 환경변수로 허용 UID 지정
        const adminCsv = (process.env.NEXT_PUBLIC_ADMIN_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
        if (adminCsv.length && !adminCsv.includes(meRes.user.id)) {
          setErr("접근 권한이 없습니다.");
          setLoading(false);
          return;
        }

        // 2) 메트릭 호출
        const j = await fetch('/api/admin/metrics?range=${range}').then(r => r.json());
        if (!j.ok) throw new Error(j.error || "metrics failed");
        setData(j);
      } catch (e) {
        setErr(e.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);  //여기까지가 useEffect
 

  if (loading) return <main className="p-6">불러오는 중…</main>;
  if (err) return <main className="p-6 text-red-400">에러: {err}</main>;

  const {
    timeSeries = [],
    topUsersOverall = [],
    topUsersEarn = [],
    topUsersRedeem = [],
    topBoothsEarn = [],
    topBoothsRedeem = [],
    domainTotals = [],
  } = data || {};

  const Card = ({ title, children }) => (
    <div className="rounded-2xl border p-4">
      <div className="font-semibold mb-2">{title}</div>
      {children}
    </div>
  );

  const RankList = ({ items }) => (
    <ol className="space-y-1">
      {items.map((x, i) => (
        <li key={i} className="flex justify-between">
          <span>{i+1}. {x.name}</span>
          <span className="font-mono">+{x.total}</span>
        </li>
      ))}
      {items.length === 0 && <li className="text-gray-500">데이터 없음</li>}
    </ol>
  );

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">운영자 대시보드</h1>
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
          <a href="/me" className="border rounded px-3 py-2">내 활동</a>
        </div>
      </div>





      {/* 0. 전체 활동포인트 – 시간대별 라인차트 */}
      <Card title='전체 활동 포인트 (일자별 합계)· ${range==="day1" ? "테스트~10/18" : "10/19~"}'>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 랭킹 4개 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title='총 활동이 많은 사람 Top3· ${range==="day1" ? "테스트~10/18" : "10/19~"}'>
          <RankList items={topUsersOverall} />
        </Card>
        <Card title='적립(Earn)이 많은 사람 Top3· ${range==="day1" ? "테스트~10/18" : "10/19~"}'>
          <RankList items={topUsersEarn} />
        </Card>
        <Card title='교환(Redeem)이 많은 사람 Top3· ${range==="day1" ? "테스트~10/18" : "10/19~"}'>
          <RankList items={topUsersRedeem} />
        </Card>
        <Card title='적립이 많은 부스 Top3 / 교환이 많은 부스 Top3· ${range==="day1" ? "테스트~10/18" : "10/19~"}'>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm mb-1">적립 Top3</div>
              <RankList items={topBoothsEarn} />
            </div>
            <div>
              <div className="text-sm mb-1">교환 Top3</div>
              <RankList items={topBoothsRedeem} />
            </div>
          </div>
        </Card>
      </div>

      {/* 6. 분야 합계 – 방사형 차트 */}
      <Card title='환경·사회·경제·정신 합계 (레이더)· ${range==="day1" ? "테스트~10/18" : "10/19~"}'>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <RadarChart data={domainTotals}>
              <PolarGrid />
              <PolarAngleAxis dataKey="domain" />
              <PolarRadiusAxis />
              <Radar dataKey="total" />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </main>
  );
}
