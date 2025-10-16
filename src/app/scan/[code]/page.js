"use client";
import { useEffect, useState } from "react";
import { enqueueScan, flushScanQueue } from "@/lib/scanQueue";

export default function ScanByPathPage({ params }) {
  const [msg, setMsg] = useState("처리 중…");
  const code = (params?.code || "").trim();

  useEffect(() => {
    (async () => {
      try {
        flushScanQueue().catch(() => {});

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

        // ✅ 로그인했지만 프로필 미완 → 가입페이지
        if (!isProfileComplete) {
          location.href = `/register?next=${next}`;
          return;
        }

        // -----------------------------
        // 로그인 + 프로필 완료된 경우
        // -----------------------------

        const eventId = crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random()}`;

        if (!navigator.onLine) {
          enqueueScan({ code, client_event_id: eventId });
          setMsg("오프라인 상태입니다. 연결되면 자동으로 등록돼요. /me로 이동합니다…");
          setTimeout(() => (location.href = "/me"), 900);
          return;
        }

        setMsg("전송 중…");
        const r = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, client_event_id: eventId }),
        });
        const j = await r.json();

        if (j.ok || j.duplicated) {
          setMsg(j.duplicated
            ? "이미 처리된 QR입니다. /me로 이동합니다…"
            : "활동이 추가되었습니다. /me로 이동합니다…"
          );
          setTimeout(() => (location.href = "/me"), 900);
        } else {
          enqueueScan({ code, client_event_id: eventId });
          setMsg("일시적인 오류로 저장해두었어요. 연결되면 자동으로 등록됩니다. /me로 이동합니다…");
          setTimeout(() => (location.href = "/me"), 1200);
        }
      } catch (e) {
        const eventId = `${Date.now()}_${Math.random()}`;
        enqueueScan({ code, client_event_id: eventId });
        console.error(e);
        setMsg("네트워크 오류로 저장해두었어요. 연결되면 자동 등록됩니다. /me로 이동합니다…");
        setTimeout(() => (location.href = "/me"), 1200);
      }
    })();
  }, [code]);

  return (
    <main style={{ padding: 24 }}>
      <h1>QR 처리</h1>
      <p>{msg}</p>
    </main>
  );
}
