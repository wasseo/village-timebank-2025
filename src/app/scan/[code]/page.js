

//app/scan/[code]/page.js (수정 완료된 전체 코드)

"use client";
import { useEffect, useState } from "react";
import { enqueueScan, flushScanQueue } from "@/lib/scanQueue";

// 환경 변수가 없어도 기본값으로 동작하도록 설정
const MAIN_URL =
  process.env.NEXT_PUBLIC_MAIN_URL || "https://village-timebank-2025.vercel.app/";

export default function ScanByPathPage({ params }) {
  const [msg, setMsg] = useState("처리 중…");
  const code = (params?.code || "").trim();

  useEffect(() => {
    // 즉시 실행 비동기 함수로 로직을 캡슐화
    (async () => {
      // 페이지 진입 시, 이전에 쌓인 오프라인 큐가 있다면 먼저 시도
      flushScanQueue().catch(() => {});

      try {
        const here = window.location.pathname + window.location.search;
        const next = encodeURIComponent(here);

        // 서버에 사용자 정보 요청 (세션 쿠키 기반)
        const me = await fetch("/api/me", { credentials: "include" })
          .then(r => r.json())
          .catch(() => null);

        const isLoggedIn = !!me?.user?.id;
        const isProfileComplete = me?.profileComplete ?? true; // 기본값을 true로 하여 null/undefined 방지

        // --- 인증 가드 로직 ---
        // 1. 미로그인 사용자 처리
        if (!isLoggedIn) {
          // ❗ [핵심 수정] 메인 페이지로 이동시킬 때 'next' 파라미터로 원래 목적지를 전달
          location.href = `${MAIN_URL}?next=${next}`;
          return; // 리디렉션 후 즉시 실행 중단
        }

        // 2. 프로필 미작성 사용자 처리
        if (!isProfileComplete) {
          location.href = `/register?next=${next}`;
          return;
        }

        // --- 인증 통과 후 스캔 처리 로직 ---
        const eventId = crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random()}`;

        // 3. 오프라인 상태 처리
        if (!navigator.onLine) {
          enqueueScan({ code, client_event_id: eventId });
          setMsg("오프라인 상태입니다. 연결되면 자동으로 등록돼요. 잠시 후 내 활동 페이지로 이동합니다…");
          setTimeout(() => (location.href = "/me"), 1200);
          return;
        }

        // 4. 온라인 상태에서 API 요청
        setMsg("서버로 전송 중…");
        const r = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, client_event_id: eventId }),
        });
        const j = await r.json();

        // 5. API 응답에 따른 처리
        if (j.ok || j.duplicated) {
          const successMsg = j.duplicated
            ? "이미 처리된 QR입니다. 잠시 후 내 활동 페이지로 이동합니다…"
            : "활동이 추가되었습니다. 잠시 후 내 활동 페이지로 이동합니다…";
          setMsg(successMsg);
          setTimeout(() => (location.href = "/me"), 900);
        } else {
          // API가 ok:false를 반환한 경우 (서버 일시적 오류 등)
          enqueueScan({ code, client_event_id: eventId });
          setMsg(`오류가 발생해 큐에 저장했어요. (${j.error || 'Unknown Error'}) 잠시 후 내 활동 페이지로 이동합니다…`);
          setTimeout(() => (location.href = "/me"), 1200);
        }
      } catch (e) {
        // 네트워크 요청 실패 등 예외 처리
        const eventId = `${Date.now()}_${Math.random()}`;
        enqueueScan({ code, client_event_id: eventId });
        console.error("Scan failed:", e);
        setMsg("네트워크 오류로 큐에 저장했어요. 잠시 후 내 활동 페이지로 이동합니다…");
        setTimeout(() => (location.href = "/me"), 1200);
      }
    })();
  }, [code]); // 'code'가 바뀔 때만 이 로직을 실행

  return (
    <main style={{ padding: 24, textAlign: 'center' }}>
      <h1>QR 스캔 처리</h1>
      <p style={{ marginTop: 16 }}>{msg}</p>
    </main>
  );
}