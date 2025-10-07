// app/scan/page.js
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// 프리렌더/정적 내보내기 방지 (안전장치)
export const dynamic = "force-dynamic";
export const revalidate = 0;

function ScanRootInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const code = sp.get("code");
    if (code) {
      router.replace(`/scan/${encodeURIComponent(code)}`);
    }
  }, [sp, router]);

  return (
    <main style={{ padding: 24 }}>
      <h1>QR 스캔</h1>
      <p>QR 코드를 처리 중입니다...</p>
    </main>
  );
}

export default function ScanRootPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p>로딩 중…</p></main>}>
      <ScanRootInner />
    </Suspense>
  );
}
