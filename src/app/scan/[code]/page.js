// app/scan/[code]/page.js
"use client";
import { useEffect, useState } from "react";
import { enqueueScan, flushScanQueue } from "@/lib/scanQueue";

export default function ScanByPathPage({ params }) {
  const [msg, setMsg] = useState("처리 중…");
  const code = (params?.code || "").trim();

  useEffect(() => {
    (async () => {
      try {
        // 0) 들어오자마자 이전에 쌓인 큐도 한 번 밀어줌
        flushScanQueue().catch(() => {});

        // 1) 로그인 확인
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        const userId = me?.user?.id;
        if (!userId) {
          const next = encodeURIComponent(window.location.pathname);
          location.href = `/login?next=${next}`;
          return;
        }

        // 2) 이벤트 ID 생성(멱등키)
        const eventId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;

        // 3) 온라인이면 즉시 전송, 아니면 큐에 적재
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
          // 서버에서 실패한 경우: 큐에 넣고 나중에 재시도
          enqueueScan({ code, client_event_id: eventId });
          setMsg("일시적인 오류로 저장해두었어요. 연결되면 자동으로 등록됩니다. /me로 이동합니다…");
          setTimeout(() => (location.href = "/me"), 1200);
        }
      } catch (e) {
        // 예외 발생 시에도 큐에 넣어 안전하게
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

