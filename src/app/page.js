"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [me, setMe] = useState(null);      // { user: { id, name? ... } }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me");
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        setMe(j || null);
      } catch {
        if (!alive) return;
        setMe(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loggedIn = !!me?.user?.id;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold">마을시간은행</h1>
        <p className="text-sm text-gray-500">
          QR을 스캔해 활동을 기록하고, <span className="font-medium">/me</span>에서 내 활동을 확인해요.
        </p>
      </header>

      {/* 상태 카드 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">상태</div>
          <div className="mt-1 text-lg font-semibold">
            {loading ? "확인 중…" : (loggedIn ? "로그인됨" : "로그인 안 됨")}
          </div>
        </div>

        {loggedIn ? (
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-500">사용자</div>
            <div className="mt-1 text-lg font-semibold break-all">
              {me?.user?.name || me?.user?.id}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-500">시작 가이드</div>
            <div className="mt-1 text-lg font-semibold">로그인 또는 회원가입</div>
          </div>
        )}

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">빠른 이동</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {loggedIn ? (
              <>
                <Link href="/profile" className="rounded-xl border px-3 py-1 hover:bg-white/5">내 정보</Link>
                <Link href="/me" className="rounded-xl border px-3 py-1 hover:bg-white/5">내 활동</Link>
                <Link href="/scan?c=DEMO" className="rounded-xl border px-3 py-1 hover:bg-white/5">QR 스캔(데모)</Link>
                <button
                  className="rounded-xl border px-3 py-1 hover:bg-white/5 ml-auto"
                  onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.reload(); }}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-xl border px-3 py-1 hover:bg-white/5">로그인</Link>
                <Link href="/register" className="rounded-xl border px-3 py-1 hover:bg-white/5">회원가입</Link>
                {/* 내부 테스트용 개발 로그인 사용 중이면 여기도 노출 */}
                {process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "1" && (
                  <Link href="/login" className="rounded-xl border px-3 py-1 hover:bg-white/5">개발 로그인</Link>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* 설명 섹션 */}
      <section className="rounded-2xl border p-4 space-y-2">
        <h2 className="text-lg font-semibold">사용 방법</h2>
        <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1">
          <li>로그인/회원가입을 합니다.</li>
          <li>행사장에서 QR을 스캔하면 활동이 기록됩니다.</li>
          <li>“내 활동(/me)”에서 합계와 레이더 차트를 확인합니다.</li>
        </ol>
      </section>
    </main>
  );
}
