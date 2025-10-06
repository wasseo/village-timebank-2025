// src/app/scan/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

const PENDING_KEY = "pendingScan";
const savePending = (p) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch {} };
const readPending  = () => { try { const v = localStorage.getItem(PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null } };
const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };

/** URL 파라미터에서 기존 API 규격(code | b/booth_id | e)로 매핑 */
function pickPayloadFromLocation() {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const code = (sp.get("code") || sp.get("c") || "").trim();
  const b    = (sp.get("b") || sp.get("booth_id") || "").trim();
  const e    = (sp.get("e") || "").trim();
  if (!code && !b) return null;
  const payload = {};
  if (code) payload.code = code;
  if (b) payload.b = b;
  if (e) payload.client_event_id = e;
  return payload;
}

/** tb://booth/<id>?k=earn&amt=2 같은 커스텀 URL도 허용 (선택 규약) */
function parseAnyText(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  if (t.startsWith("tb://")) {
    try {
      const u = new URL(t);
      const parts = u.pathname.replace(/^\/+/, "").split("/");
      const boothId = parts[1] || "";
      const k = (u.searchParams.get("k") || "earn").toLowerCase();
      const amt = Number(u.searchParams.get("amt") || 1);
      if (!boothId) return null;
      return { b: boothId, kind: k === "redeem" ? "redeem" : "earn", amount: Math.max(1, amt) };
    } catch {}
  }
  // 그 외엔 code 또는 booth-id로 시도
  if (/^booth[-_]/i.test(t)) return { b: t };
  return { code: t }; // 문자열 코드로 처리
}

export default function ScanPage() {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const [torch, setTorch] = useState(false);
  const [msg, setMsg] = useState("카메라 준비 중…");
  const [last, setLast] = useState(null);
  const [manual, setManual] = useState("");

  // 로그인 후 자동복귀 처리
  useEffect(() => {
    (async () => {
      const urlSp = new URLSearchParams(location.search);
      if (urlSp.get("auto") !== "1") return;

      const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
      if (!me?.user?.id) return;

      const pending = readPending();
      if (!pending) return;

      setMsg("이전 스캔 자동 처리 중…");
      await sendToServer(pending);
    })();
  }, []);

  // 카메라 스캐너 시작
  useEffect(() => {
    let active = true;

    (async () => {
      // URL에 바로 값이 있을 수도 있으니 우선 처리 시도
      const fromUrl = pickPayloadFromLocation();
      if (fromUrl) {
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          savePending(fromUrl);
          location.href = `/login?next=${encodeURIComponent("/scan?auto=1")}`;
          return;
        }
        setMsg("전송 중…");
        await sendToServer(fromUrl);
        return;
      }

      // 카메라 시작
      try {
        const scanner = new QrScanner(
          videoRef.current,
          result => {
            if (!active) return;
            handleScanResult(result?.data || result);
          },
          { returnDetailedScanResult: true }
        );
        scannerRef.current = scanner;
        await scanner.start();
        setMsg("QR을 화면 중앙에 맞춰주세요.");
      } catch (e) {
        setMsg("카메라 접근이 거부되었거나 사용할 수 없습니다.");
      }
    })();

    return () => {
      active = false;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
    };
  }, []);

  async function toggleTorch() {
    try {
      const has = await scannerRef.current?.hasFlash();
      if (!has) return alert("해당 기기는 플래시를 지원하지 않습니다.");
      if (torch) await scannerRef.current?.turnFlashOff();
      else await scannerRef.current?.turnFlashOn();
      setTorch(!torch);
    } catch {
      alert("플래시 제어를 사용할 수 없습니다.");
    }
  }

  async function handleScanResult(text) {
    const payload = parseAnyText(text);
    if (!payload) {
      setMsg("QR 형식이 올바르지 않습니다.");
      return;
    }

    // 로그인 확인
    const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
    if (!me?.user?.id) {
      savePending(payload);
      location.href = `/login?next=${encodeURIComponent("/scan?auto=1")}`;
      return;
    }

    setMsg("전송 중…");
    await sendToServer(payload);
  }

  async function sendToServer(payload) {
    setLast(payload);
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, client_event_id: crypto.randomUUID?.() }),
      });
      const j = await r.json();

      if (j.ok) {
        clearPending();
        setMsg(j.duplicated
          ? "이미 처리된 QR입니다. /me로 이동합니다…"
          : "활동이 추가되었습니다. /me로 이동합니다…"
        );
        setTimeout(() => (location.href = "/me"), 900);
      } else {
        setMsg(`실패: ${j.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      setMsg(`에러: ${e.message || "요청 실패"}`);
    }
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await QrScanner.scanImage(f, { returnDetailedScanResult: false });
      await handleScanResult(text);
    } catch {
      setMsg("이미지에서 QR을 읽지 못했습니다.");
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold">QR 스캔</h1>

      {/* 카메라 영역 */}
      <div className="rounded-2xl overflow-hidden border">
        <video ref={videoRef} className="w-full aspect-[3/4] object-cover bg-black" muted />
      </div>

      {/* 액션 버튼들 */}
      <div className="flex gap-2">
        <button className="border rounded px-3 py-2" onClick={toggleTorch}>
          {torch ? "플래시 끄기" : "플래시 켜기"}
        </button>
        <label className="border rounded px-3 py-2 cursor-pointer">
          이미지에서 스캔
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
        <a href="/me" className="border rounded px-3 py-2 inline-flex items-center">내 활동</a>
      </div>

      {/* 수동 입력 백업 */}
      <div className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="코드 또는 booth-xxx 또는 tb://booth/.."
          className="border rounded px-3 py-2 w-full"
        />
        <button className="border rounded px-3 py-2" onClick={() => handleScanResult(manual)}>
          입력 처리
        </button>
      </div>

      {/* 상태/마지막 처리 */}
      <div className="space-y-1">
        <div className="text-sm text-gray-600">{msg}</div>
        {last && (
          <div className="text-xs text-gray-500">
            마지막 처리: {JSON.stringify(last)}
          </div>
        )}
      </div>
    </div>
  );
}
