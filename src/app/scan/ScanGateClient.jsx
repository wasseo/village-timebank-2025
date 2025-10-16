// app/scan/ScanGateClient.jsx

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
      const isProfileComplete = !!me?.profileComplete;

      // ▼▼▼ [핵심 수정] ▼▼▼
      // 메인 페이지로 보낼 때, 로그인 후 돌아올 경로(next)를 전달합니다.
      // 메인 페이지의 로그인 링크가 이 next 값을 회원가입/로그인 페이지로 넘겨줘야 합니다.
      if (!isLoggedIn) { 
        // 예시: 메인 페이지가 next 파라미터를 받아 로그인 버튼에 적용한다고 가정
        location.href = `${MAIN_URL}?next=${next}`; 
        return; 
      }
      // ▲▲▲ [핵심 수정] ▲▲▲

      if (!isProfileComplete) { location.href = `/register?next=${next}`; return; }

      setOk(true);
    })();
  }, []);

  if (!ok) return null;
  return children;
}