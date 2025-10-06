// src/app/scan/page.js
"use client";
import { useEffect, useState } from "react";

export default function ScanPage() {
  const [msg, setMsg] = useState("처리 중…");

  useEffect(() => {
    (async () => {
      try {
        // 1) 로그인 확인
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          location.href = `/login?next=${next}`;
          return;
        }

        // 2) 쿼리 파라미터 파싱 (둘 다 지원)
        const sp = new URLSearchParams(window.location.search);
        const code = (sp.get("code") || sp.get("c") || "").trim();   // 문자열 code
        const b    = (sp.get("b")    || sp.get("booth_id") || "").trim(); // UUID booth_id
        const e    = (sp.get("e")    || "").trim();                  // client_event_id(선택)

        if (!code && !b) {
          setMsg("QR에 code 또는 b(booth_id) 파라미터가 없습니다.");
          return;
        }

        // 3) API 호출: 존재하는 키만 보냄
        const payload = { ...(code && { code }), ...(b && { b }), ...(e && { client_event_id: e }) };

        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json();

        if (j.ok) {
          setMsg(j.duplicated ? "이미 처리된 QR입니다. /me로 이동합니다…" : "활동이 추가되었습니다. /me로 이동합니다…");
          setTimeout(() => (location.href = "/me"), 900);
        } else {
          setMsg(`실패: ${j.error || "알 수 없는 오류"}`);
        }
      } catch (e) {
        setMsg(`에러: ${e.message}`);
      }
    })();
  }, []);

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">QR 처리</h1>
      <p className="text-sm text-gray-600">{msg}</p>
    </div>
  );
}
