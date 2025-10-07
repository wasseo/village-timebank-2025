// src/app/scan/[slug]/page.js
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScanSlugPage({ params }) {
  const router = useRouter();
  const slug = params.slug;

  useEffect(() => {
    if (!slug) return;
    // 기존 스캔 페이지로 code 파라미터 전달
    router.replace(`/scan?code=${encodeURIComponent(slug)}`);
  }, [slug, router]);

  return (
    <div className="flex items-center justify-center h-screen text-gray-600">
      <div className="text-center space-y-2">
        <p>QR 코드 처리 중...</p>
        <p className="text-xs text-gray-400">{slug}</p>
      </div>
    </div>
  );
}
