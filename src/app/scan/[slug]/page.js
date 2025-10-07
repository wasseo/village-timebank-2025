"use client";

import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function ScanSlugRedirectPage() {
  const { slug } = useParams();      // /scan/[slug]
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!slug) return;
    // e 파라미터가 있으면 같이 넘김 (멱등성 등 유지용)
    const e = sp.get("e");
    const qs = e ? `?code=${encodeURIComponent(slug)}&e=${encodeURIComponent(e)}` 
                 : `?code=${encodeURIComponent(slug)}`;
    router.replace(`/scan${qs}`);
  }, [slug]);

  return (
    <div className="p-6 max-w-md mx-auto">
      <p className="text-sm text-gray-600">QR 처리로 이동 중…</p>
    </div>
  );
}

