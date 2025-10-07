// src/app/scan/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

// QrScanner worker 경로 (public 폴백 포함)
try {
  // eslint-disable-next-line import/no-webpack-loader-syntax
  // @ts-ignore
  import("qr-scanner/qr-scanner-worker.min.js?worker&url")
    .then((m) => { if (m?.default) QrScanner.WORKER_PATH = m.default; })
    .catch(() => { QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js"; });
} catch {
  QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";
}

/* ---------- 로컬 스토리지 ---------- */
const PENDING_KEY = "pendingScan";
const savePending = (p) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch {} };
const readPending  = () => { try { const v = localStorage.getItem(PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null } };
const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };

/* ---------- URL → payload ---------- */
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

/* ---------- text(any) → payload ---------- */
function parseAnyText(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  // tb://booth/xxx
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
  // booth-xxx
  if (/^booth[-_]/i.test(t)) return { b: t };

  // http(s) URL → /scan/<slug> 또는 ?code= 추출 시도
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const qpCode  = (u.searchParams.get("code") || u.searchParams.get("c") || "").trim();
      const qpBooth = (u.searchParams.get("b") || u.searchParams.get("booth_id") || "").trim();
      const qpE     = (u.searchParams.get("e") || "").trim();
      if (qpCode || qpBooth) {
        const payload = {};
        if (qpCode) payload.code = qpCode;
        if (qpBooth) payload.b = qpBooth;
        if (qpE) payload.client_event_id = qpE;
        return payload;
      }
      const m2 = u.pathname.match(/\/(scan|s)\/([A-Za-z0-9\-_.~]+)/);
      if (m2?.[2]) return { code: m2[2] };
      const m3 = u.pathname.match(/\/booth\/([A-Za-z0-9\-_.~]+)/);
      if (m3?.[1]) return { b: m3[1] };
      return { code: t }; // 최후수단: 전체 URL을 code로 (서버 정규화)
    } catch {}
  }
  return { code: t };
}

/* ---------- iOS 감지 ---------- */
function getIOSContext() {
  if (typeof window === "undefined") return { isIOS: false, isStandalone: false, isSafari: false };
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  const isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|OPiOS/i.test(ua);
  return { isIOS, isStandalone, isSafari };
}

export default function ScanPage() {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  const [msg, setMsg] = useState("카메라/링크 준비 중…");
  const [last, setLast] = useState(null);
  const [manual, setManual] = useState("");

  // iOS 안내
  const [{ isIOS, isStandalone, isSafari }, setIOSCtx] = useState({ isIOS: false, isStandalone: false, isSafari: true });

  // 스캐너 ON/OFF (기본 OFF, 사용자 탭으로만 ON)
  const [webQrOn, setWebQrOn] = useState(false);
  const [torch, setTorch] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(false);

  // 가드
  const sendingRef = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const [debug, setDebug] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  // 로그인 후 자동복귀
  useEffect(() => {
    setIOSCtx(getIOSContext());
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

  // URL 파라미터 즉시 처리 (?code=)
  useEffect(() => {
    (async () => {
      const fromUrl = pickPayloadFromLocation();
      if (!fromUrl) return;
      const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
      if (!me?.user?.id) {
        savePending(fromUrl);
        location.href = `/login?next=${encodeURIComponent("/scan?auto=1")}`;
        return;
      }
      setMsg("전송 중…");
      await sendToServer(fromUrl);
    })();
  }, []);

  // 스캐너 시작/정리 (webQrOn일 때만)
  useEffect(() => {
    if (!webQrOn) return;

    let active = true;
    (async () => {
      try {
        setLoading(true);
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (!active) return;
            const text = result?.data || result;
            if (sendingRef.current || cooldown > 0) return;
            handleScanResult(text);
          },
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 8,
            preferredResolution: 1280,
            // @ts-ignore
            tryInverted: true,
            onDecodeError: (e) => { if (showDebug) setDebug(String(e?.message || e || "")); },
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
        const cams = await QrScanner.listCameras(true);
        setDevices(cams);
        const saved = localStorage.getItem("vtb:lastDeviceId");
        if (saved && cams.some(c => c.id === saved)) {
          await scanner.setCamera(saved);
          setDeviceId(saved);
        }
        setMsg("웹 스캔(베타) 사용 중: QR을 화면 중앙에 맞춰주세요.");
      } catch (e) {
        console.warn(e);
        setMsg("브라우저에서 카메라 사용이 불가합니다. 기본 카메라 앱으로 스캔하세요.");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      try { scannerRef.current?.stop(); } catch {}
      try { scannerRef.current?.destroy(); } catch {}
      try {
        const stream = videoRef.current?.srcObject;
        stream?.getTracks?.().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      } catch {}
    };
  }, [webQrOn, cooldown, showDebug]);

  // 외부 링크 이동 시 스캐너 정리
  async function navigateExternal(url) {
    setMsg("링크로 이동 중…");
    sendingRef.current = true;
    setCooldown(2);
    try { await scannerRef.current?.turnFlashOff?.(); } catch {}
    try { await scannerRef.current?.stop?.(); } catch {}
    try { scannerRef.current?.destroy?.(); } catch {}
    try {
      const stream = videoRef.current?.srcObject;
      stream?.getTracks?.().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {}
    const target = String(url);
    setTimeout(() => { window.location.replace(target); }, 50);
    setTimeout(() => {
      if (document.visibilityState === "visible") {
        const a = document.createElement("a");
        a.href = target; a.target = "_self"; a.rel = "noreferrer";
        document.body.appendChild(a); a.click();
      }
    }, 1000);
  }

  // 스캔 처리
  async function handleScanResult(text) {
    const raw = String(text || "").trim();
    if (!raw) { setMsg("QR 형식이 올바르지 않습니다."); return; }
    if (/^https?:\/\//i.test(raw)) {
      await navigateExternal(raw);   // 네이버 단축링크 등
      return;
    }
    const payload = parseAnyText(raw);
    if (!payload) { setMsg("QR 형식이 올바르지 않습니다."); return; }

    const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
    if (!me?.user?.id) {
      savePending(payload);
      location.href = `/login?next=${encodeURIComponent("/scan?auto=1")}`;
      return;
    }
    setMsg("전송 중…");
    await sendToServer(payload);
  }

  // 서버 전송
  async function sendToServer(payload) {
    if (sendingRef.current || cooldown > 0) return;
    sendingRef.current = true;
    setCooldown(2);
    setLast(payload);
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, client_event_id: crypto.randomUUID?.() }),
      });
      if (r.status === 429) {
        await new Promise(res => setTimeout(res, 500));
        sendingRef.current = false;
        return await sendToServer(payload);
      }
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        clearPending();
        setMsg(j.duplicated ? "이미 처리된 QR입니다. /me로 이동합니다…" : "활동이 추가되었습니다. /me로 이동합니다…");
        setTimeout(() => (location.href = "/me"), 900);
      } else {
        setMsg(`실패: ${j.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      setMsg(`에러: ${e.message || "요청 실패"}`);
    } finally {
      sendingRef.current = false;
    }
  }

  // 이미지 업로드 스캔
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

  // 토글 시 안전 정리
  function toggleWebScanner() {
    if (webQrOn) {
      try { scannerRef.current?.stop(); } catch {}
      try { scannerRef.current?.destroy(); } catch {}
      try {
        const stream = videoRef.current?.srcObject;
        stream?.getTracks?.().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      } catch {}
      setTorch(false);
      setMsg("웹 스캔을 끔. 기본 카메라로 스캔하세요.");
      setWebQrOn(false);
    } else {
      setWebQrOn(true);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold">QR 스캔</h1>

      {/* 안내 (iPhone/PWA 등) */}
      {isIOS && (
        <div className="text-xs rounded-lg border p-3 bg-amber-50 border-amber-200 text-amber-900">
          {!isSafari && <p>iPhone에서는 <b>Safari</b>에서 가장 안정적입니다.</p>}
          {isStandalone && <p className="mt-1">홈 화면(PWA) 모드에서는 카메라 권한 팝업이 제한될 수 있어요.</p>}
        </div>
      )}

      {/* 기본 흐름: OS 카메라로 스캔 */}
      <div className="rounded-lg border p-3 space-y-2 bg-gray-50">
        <p className="text-sm">
          <b>추천:</b> 휴대폰 <b>기본 카메라 앱</b>으로 QR을 찍으면 자동으로 이 페이지(/scan?code=)로 연결되어 적립됩니다.
        </p>
        <div className="flex gap-2">
          <label className="border rounded px-3 py-2 cursor-pointer">
            이미지에서 스캔
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <button
            className="border rounded px-3 py-2"
            onClick={async () => {
              try {
                const txt = await navigator.clipboard.readText();
                if (txt) await handleScanResult(txt);
              } catch {
                alert("클립보드 읽기 권한이 필요합니다. 직접 붙여넣기 해주세요.");
              }
            }}
          >
            클립보드에서 붙여넣기
          </button>
        </div>
      </div>

      {/* 수동 입력 */}
      <div className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="코드 또는 URL 붙여넣기"
          className="border rounded px-3 py-2 w-full"
        />
        <button
          className="border rounded px-3 py-2"
          onClick={() => handleScanResult(manual)}
        >
          입력 처리
        </button>
      </div>

      {/* 웹 스캔 (베타) 토글 */}
      <div className="flex items-center gap-2">
        <button className="border rounded px-3 py-2" onClick={toggleWebScanner}>
          {webQrOn ? "웹 스캔 끄기(베타)" : "웹 스캔 켜기(베타)"}
        </button>
        {webQrOn && (
          <>
            <button className="border rounded px-3 py-2" onClick={async () => {
              try {
                const has = await scannerRef.current?.hasFlash();
                if (!has) return alert("이 기기는 플래시를 지원하지 않습니다.");
                if (torch) await scannerRef.current?.turnFlashOff();
                else await scannerRef.current?.turnFlashOn();
                setTorch(!torch);
              } catch { alert("플래시 제어를 사용할 수 없습니다."); }
            }}>
              {torch ? "플래시 끄기" : "플래시 켜기"}
            </button>
            <label className="text-xs flex items-center gap-1 ml-auto cursor-pointer select-none">
              <input type="checkbox" checked={showDebug} onChange={(e)=>setShowDebug(e.target.checked)} />
              디코딩 디버그
            </label>
          </>
        )}
      </div>

      {/* 카메라 프리뷰 (웹 스캔이 켜졌을 때만) */}
      {webQrOn && (
        <div className="relative rounded-2xl overflow-hidden border">
          <video
            ref={videoRef}
            className="w-full aspect-[3/4] object-cover bg-black"
            muted
            playsInline
            autoPlay
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-black/30">
              카메라 로딩 중…
            </div>
          )}
        </div>
      )}

      {/* 상태 */}
      <div className="space-y-1">
        <div className="text-sm text-gray-600">{msg}</div>
        {last && (
          <div className="text-xs text-gray-500 break-all">마지막 처리: {JSON.stringify(last)}</div>
        )}
        {showDebug && debug && (
          <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all border rounded p-2 bg-gray-50">{debug}</pre>
        )}
      </div>
    </div>
  );
}
