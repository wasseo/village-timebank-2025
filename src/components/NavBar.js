// src/components/NavBar.js
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { flushScanQueue, installOnlineFlush } from "@/lib/scanQueue"; // ✅ 추가

export default function NavBar() {
  // ✅ 오프라인 시 쌓인 스캔 데이터 자동 전송
  useEffect(() => {
    // 진입 시 한 번 플러시
    flushScanQueue().catch(() => {});
    // 온라인 복귀 / 주기적 자동 플러시
    const off = installOnlineFlush();
    return () => { off && off(); };
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  };

  return (
    <header className="p-4 border-b mb-4 flex gap-4">
      <Link className="underline" href="/">홈</Link>
      <Link className="underline" href="/profile">내 정보</Link>
      <Link className="underline" href="/me">내 활동</Link>

      <button className="ml-auto underline" onClick={logout}>
        로그아웃
      </button>
    </header>
  );
}

