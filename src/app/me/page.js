// src/app/me/page.js
"use client";

import { useEffect, useState } from "react";

export default function MyPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState({
    total: 0,
    byKind: { earn: 0, redeem: 0 },
    byCategory: { environment: 0, social: 0, economic: 0, mental: 0 },
  });
  const [list, setList] = useState([]);

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

        // 최근 활동/합계
        const acts = await fetch("/api/activities").then(r => r.json());
        if (!acts?.ok) throw new Error(acts?.error || "활동을 불러오지 못했습니다.");

        setSummary(acts.summary || summary);
        setList(Array.isArray(acts.list) ? acts.list.slice(0, 2) : []); // ✅ 최근 2개만
      } catch (e) {
        setErr(e.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <main className="p-6">불러오는 중…</main>;
  if (err) return <main className="p-6 text-red-500">에러: {err}</main>;

  const KR = {
    environment: "환경",
    social: "사회",
    economic: "경제",
    mental: "정신",
  };

  const fmt = (n) => `+${Number(n || 0)}`;

  const StatCard = ({ title, value }) => (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-2xl font-bold">{fmt(value)}</div>
    </div>
  );

  const ActivityItem = ({ a }) => {
    const d = new Date(a.created_at);
    const when = isNaN(+d) ? "" : d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const kindLabel = a.kind === "redeem" ? "교환" : "적립";
    return (
      <li className="flex items-center justify-between py-2">
        <div className="text-sm">
          <div className="font-medium">{kindLabel}</div>
          <div className="text-gray-500">{when}</div>
        </div>
        <div className="font-mono">{fmt(a.amount)}</div>
      </li>
    );
  };

  return (
    <main className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">내 활동</h1>

      {/* 합계 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="총 합계" value={summary.total} />
        <StatCard title="적립(Earn)" value={summary.byKind?.earn} />
        <StatCard title="교환(Redeem)" value={summary.byKind?.redeem} />
      </div>

      {/* ✅ 활동자산 (레이더 삭제 → 한글 도메인 합계 카드로 대체) */}
      <section className="rounded-2xl border p-4">
        <div className="font-semibold mb-3">활동자산</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title={KR.environment} value={summary.byCategory?.environment} />
          <StatCard title={KR.social} value={summary.byCategory?.social} />
          <StatCard title={KR.mental} value={summary.byCategory?.mental} />
          <StatCard title={KR.economic} value={summary.byCategory?.economic} />
        </div>
      </section>

      {/* ✅ 최근 활동: 2개만 표시 */}
      <section className="rounded-2xl border p-4">
        <div className="font-semibold mb-2">최근 활동</div>
        {list.length === 0 ? (
          <div className="text-gray-500 text-sm">활동이 아직 없습니다.</div>
        ) : (
          <ul>
            {list.map((a) => <ActivityItem key={a.id} a={a} />)}
          </ul>
        )}
      </section>

      {/* ✅ 디버그 정보 섹션은 삭제 */}
    </main>
  );
}
