// app/scan/[code]/page.js
"use client";
import { useEffect, useState } from "react";

export default function ScanByPathPage({ params }) {
  const [msg, setMsg] = useState("처리 중…");
  const code = (params?.code || "").trim();

  useEffect(() => {
    (async () => {
      try {
        // 1) 로그인 확인 (iron-session)
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        const userId = me?.user?.id;
        if (!userId) {
          const next = encodeURIComponent(window.location.pathname);
          location.href = `/login?next=${next}`;
          return;
        }

        // 2) 서버 API로 전달 (기존 /scan/page.js와 동일한 방식)
        setMsg("전송 중…");
        const r = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, client_event_id: crypto.randomUUID?.() }),
        });
        const j = await r.json();

        if (j.ok) {
          setMsg(j.duplicated
            ? "이미 처리된 QR입니다. /me로 이동합니다…"
            : "활동이 추가되었습니다. /me로 이동합니다…"
          );
          setTimeout(() => (location.href = "/me"), 900);
        } else {
          setMsg(`실패: ${j.error || "알 수 없는 오류"}`);
        }
      } catch (e) {
        console.error(e);
        setMsg(`에러: ${e.message || "요청 실패"}`);
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
