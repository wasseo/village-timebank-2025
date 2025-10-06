"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const QUEUE_KEY = "scanQueueV1"; // [{code, ts, client_event_id}]
const RETRY_INTERVAL_MS = 10_000;

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function uuidv4() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  // fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function EarnPage() {
  const [status, setStatus] = useState("init"); // init | scanning | success | error | queued
  const [message, setMessage] = useState("");
  const [code, setCode] = useState(null);
  const [userId, setUserId] = useState(null);
  const retryTimer = useRef(null);

  const searchCode = useMemo(() => {
    if (typeof window === "undefined") return null;
    const u = new URL(window.location.href);
    return u.searchParams.get("b");
  }, []);

  // 로그인 유저 확인
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !data?.user?.id) {
        setStatus("error");
        setMessage("로그인이 필요합니다.");
        return;
      }
      setUserId(data.user.id);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 최초 코드 파싱
  useEffect(() => {
    if (searchCode) setCode(searchCode);
  }, [searchCode]);

  // 재시도 핸들러
  const tryFlushQueue = async () => {
    const q = loadQueue();
    if (!q.length || !userId) return;

    const remain = [];
    for (const item of q) {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: item.code,
            user_id: userId,
            client_event_id: item.client_event_id,
          }),
        });
        const json = await res.json();
        if (!json?.ok) {
          // 그대로 남김
          remain.push(item);
        }
      } catch {
        remain.push(item);
      }
    }
    saveQueue(remain);
    if (remain.length === 0 && status === "queued") {
      setStatus("success");
      setMessage("오프라인 큐가 전송되어 활동이 기록됐습니다. /me에서 확인하세요.");
    }
  };

  // 온라인/포커스/주기적 재시도
  useEffect(() => {
    if (!userId) return;
    const onOnline = () => tryFlushQueue();
    const onFocus = () => tryFlushQueue();

    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    retryTimer.current = setInterval(tryFlushQueue, RETRY_INTERVAL_MS);

    // 최초 한 번
    tryFlushQueue();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      if (retryTimer.current) clearInterval(retryTimer.current);
    };
  }, [userId]);

  // 즉시 스캔 호출
  useEffect(() => {
    if (!userId || !code) return;

    const doScan = async () => {
      setStatus("scanning");
      setMessage("스캔 처리 중…");

      const client_event_id = uuidv4();

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, user_id: userId, client_event_id }),
        });
        const json = await res.json();

        if (json?.ok) {
          setStatus("success");
          setMessage("활동이 기록되었습니다. /me 페이지에서 확인하세요.");
          // 성공했으니 끝
          return;
        }

        // 서버 응답은 왔지만 실패 → 큐 적재
        const q = loadQueue();
        q.push({ code, ts: Date.now(), client_event_id });
        saveQueue(q);
        setStatus("queued");
        setMessage(
          `오프라인(또는 서버 오류)으로 큐에 저장했어요. 네트워크가 연결되면 자동 재전송됩니다. (큐: ${q.length})`
        );
      } catch (err) {
        // 네트워크 에러 → 큐 적재
        const q = loadQueue();
        q.push({ code, ts: Date.now(), client_event_id });
        saveQueue(q);
        setStatus("queued");
        setMessage(
          `오프라인(또는 서버 오류)으로 큐에 저장했어요. 네트워크가 연결되면 자동 재전송됩니다. (큐: ${q.length})`
        );
      }
    };

    doScan();
  }, [userId, code]);

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">QR 스캔</h1>
      <p className="text-sm text-gray-500">
        이 페이지는 QR 링크로 접근됩니다. 예: <code>/earn?b=부스코드</code>
      </p>

      <div className="rounded-2xl border p-4">
        <div className="text-sm text-gray-500 mb-2">스캔 상태</div>
        <div className="text-lg font-semibold">
          {status === "init" && "대기 중"}
          {status === "scanning" && "처리 중…"}
          {status === "success" && "성공!"}
          {status === "error" && "오류"}
          {status === "queued" && "오프라인 큐 저장"}
        </div>
        {message && <div className="mt-2 text-sm">{message}</div>}
        {code && (
          <div className="mt-3 text-xs text-gray-500">
            code=<code>{code}</code>
          </div>
        )}
      </div>

      <div className="rounded-2xl border p-4">
        <div className="text-sm font-medium">오프라인 큐</div>
        <pre className="mt-2 text-xs overflow-auto">
{JSON.stringify(loadQueue(), null, 2)}
        </pre>
      </div>

      <div className="text-sm text-gray-500">
        기록 후 <code>/me</code> 페이지에서 적립/교환 합산이 양수로 누적되어 반영됩니다.
      </div>
    </div>
  );
}
