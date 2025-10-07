// app/scan/page.js
"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ScanRootPage() {
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
      <h1>QR 스캔 중...</h1>
      <p>잠시만 기다려 주세요.</p>
    </main>
  );
}
