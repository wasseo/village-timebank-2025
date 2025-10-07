// app/scan/ScanRootClient.jsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ScanRootClient() {
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
