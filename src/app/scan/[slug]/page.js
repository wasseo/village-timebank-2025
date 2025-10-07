"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

// 스캔 페이지와 동일한 pending 저장 키
const PENDING_KEY = "pendingScan";
const savePending = (p) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch {} };
const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };

export default function ScanSlugPage() {
  const { slug } = useParams();             // /scan/[slug]
  const sp = useSearchParams();             // 쿼리(e 등 추가 파라미터)
  const router = useRouter();

  const [msg, setMsg] = useState("처리 준비 중…");
  const [debug, setDebug] = useState(null);
  const sending = useRef(false);

  useEffect(() => {
    (async () => {
      if (!slug || sending.current) return;
      sending.current = true;

      // 1) 로그인 확인
      try {
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          // 로그인 후 자동복귀를 위해 payload 저장
          const payload = { code: slug };
          const e = sp.get("e");
          if (e) payload.client_event_id = e;
          savePending(payload);
          // 로그인 후 다시 이 페이지로 돌아오도록 next 지정
          const next = `/scan/${encodeURIComponent(slug)}?auto=1${e ? `&e=${encodeURIComponent(e)}` : ""}`;
          location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
      } catch {}

      setMsg("전송 중…");

      // 2) 활동 적립 호출
      try {
        const payload = {
          code: String(slug),
          // 멱등성 이벤트 ID (있으면 그대로, 없으면 새로)
          client_event_id:
            sp.get("e") ||
            (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `evt_${Date.now()}`)
        };

        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const j = await res.json().catch(() => ({}));

        if (j.ok) {
          clearPending();
          setMsg(j.duplicated ? "이미 처리된 QR입니다. 이동합니다…" : "활동이 추가되었습니다. 이동합니다…");
          setTimeout(() => { router.replace("/me"); }, 800);
          return;
        }

        if (res.status === 401) {
          // 권한 만료 등: 로그인 유도
          savePending({ code: slug });
          const next = `/scan/${encodeURIComponent(slug)}?auto=1`;
          location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }

        setMsg(`실패: ${j.error || "알 수 없는 오류"}`);
        setDebug(j.debug || null);
      } catch (e) {
        setMsg(`에러: ${e?.message || "요청 실패"}`);
      }
    })();
  }, [slug]);

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold">QR 처리</h1>
      <div className="text-sm text-gray-600">{msg}</div>
      {debug && (
        <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all border rounded p-2 bg-gray-50">
          {JSON.stringify(debug)}
        </pre>
      )}

      {/* 안전망: 수동 버튼 */}
      <button
        className="border rounded px-3 py-2"
        onClick={() => location.href = `/scan?code=${encodeURIComponent(slug)}`}
      >
        인식이 안되면 /scan?code로 이동
      </button>
    </div>
  );
}
