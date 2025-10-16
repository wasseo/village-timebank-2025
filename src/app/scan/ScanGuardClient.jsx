"use client";
import { useEffect, useState } from "react";

const MAIN_URL =
  process.env.NEXT_PUBLIC_MAIN_URL || "https://village-timebank-2025.vercel.app/";

export default function ScanGateClient({ children }) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      const here = window.location.pathname + window.location.search;
      const next = encodeURIComponent(here);

      const me = await fetch("/api/me", { credentials: "include" })
        .then(r => r.json())
        .catch(() => null);

      const isLoggedIn = !!me?.user?.id;
      const isProfileComplete = !!me?.profileComplete; // 폴백 없이 명확하게

      if (!isLoggedIn) { location.href = MAIN_URL; return; }
      if (!isProfileComplete) { location.href = `/register?next=${next}`; return; }

      setOk(true);
    })();
  }, []);

  if (!ok) return null; // 통과 전엔 자식 렌더 금지 (레이스 방지)
  return children;
}
