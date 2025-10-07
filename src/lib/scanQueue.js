// src/lib/scanQueue.js
const KEY = "scanQueue_v1";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {}
}

export function enqueueScan(item) {
  const arr = load();
  arr.push({
    code: item.code,
    client_event_id: item.client_event_id,
    enqueued_at: Date.now()
  });
  save(arr);
}

export function getQueueLength() {
  return load().length;
}

export async function flushScanQueue() {
  if (typeof window === "undefined") return { done: 0, left: 0 };
  let arr = load();
  let done = 0;

  // 순차 처리: 성공/중복이면 제거, 실패면 그대로 둠
  const next = [];
  for (const it of arr) {
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: it.code, client_event_id: it.client_event_id }),
      });
      const j = await r.json();
      if (j?.ok || j?.duplicated) {
        done += 1; // 성공 또는 멱등 중복 처리
      } else {
        next.push(it); // 서버 에러 등: 보류
      }
    } catch {
      next.push(it);   // 네트워크 실패: 보류
    }
  }
  save(next);
  return { done, left: next.length };
}

export function installOnlineFlush() {
  if (typeof window === "undefined") return;
  const handler = () => { flushScanQueue(); };
  window.addEventListener("online", handler);
  // 가끔 백그라운드에서도 밀어주기
  const id = setInterval(() => { if (navigator.onLine) flushScanQueue(); }, 30_000);
  return () => {
    window.removeEventListener("online", handler);
    clearInterval(id);
  };
}
