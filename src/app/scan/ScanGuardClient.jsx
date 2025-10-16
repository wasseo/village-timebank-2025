
// app/scan/ScanGuardClient.jsx
"use client";
import { useEffect, useState } from "react";

const MAIN_URL =
  process.env.NEXT_PUBLIC_MAIN_URL || "https://village-timebank-2025.vercel.app/"; // ✅ 추가

export default function ScanGuardClient() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const here = window.location.pathname + window.location.search;
        const next = encodeURIComponent(here);

        const me = await fetch("/api/me", { credentials: "include" })
          .then(r => r.json())
          .catch(() => null);

        const isLoggedIn = !!me?.user?.id;
        const isProfileComplete = me?.profileComplete ?? true;

        if (!isLoggedIn) {
          // ✅ 미로그인 → 메인으로
          location.href = MAIN_URL;
          return;
        }

        if (!isProfileComplete) {
          location.href = `/register?next=${next}`;
          return;
        }
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  if (!checked) return null;
  return null;
}
