"use client";
import { useEffect, useState } from "react";

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

        // ✅ 미로그인 → 메인페이지
        if (!isLoggedIn) {
          location.href = "/";
          return;
        }

        // ✅ 로그인 but 프로필 미완 → 가입페이지
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
