// src/app/scan/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

/* --------- QrScanner Worker 설정 (Next/Webpack 호환 + 폴백) --------- */
try {
  // 방식 A: 번들러가 ?worker&url을 지원하면 이게 제일 편함
  // eslint-disable-next-line import/no-webpack-loader-syntax
  // @ts-ignore
  import("qr-scanner/qr-scanner-worker.min.js?worker&url").then((m) => {
    if (m?.default) QrScanner.WORKER_PATH = m.default;
  }).catch(() => {
    // 방식 B: public 폴백 (public/qr-scanner-worker.min.js에 파일을 두세요)
    QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";
  });
} catch {
  QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";
}

/* ---------- 로컬 스토리지 헬퍼 ---------- */
const PENDING_KEY = "pendingScan";
const savePending = (p) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch {} };
const readPending  = () => { try { const v = localStorage.getItem(PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null } };
const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };

/* ---------- URL 파라미터 → payload 매핑 ---------- */
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

/* ---------- 텍스트(any) → payload 파싱 ---------- */
function parseAnyText(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  // 1) 우리 규격 tb://booth/<id>?k=earn&amt=2
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

  // 2) booth-xxx 직접 코드
  if (/^booth[-_]/i.test(t)) return { b: t };

  // 3) http(s) URL일 때: /scan/<slug> 또는 ?code=… 추출
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);

      // (a) 쿼리파라미터 우선
      const qpCode = (u.searchParams.get("code") || u.searchParams.get("c") || "").trim();
      const qpBooth = (u.searchParams.get("b") || u.searchParams.get("booth_id") || "").trim();
      const qpE = (u.searchParams.get("e") || "").trim();
      if (qpCode || qpBooth) {
        const payload = {};
        if (qpCode) payload.code = qpCode;
        if (qpBooth) payload.b = qpBooth;
        if (qpE) payload.client_event_id = qpE;
        return payload;
      }

      // (b) /scan/<slug> 또는 /s/<slug> 형태에서 slug 추출
      const path = u.pathname.replace(/^\/+/, ""); // e.g. "scan/gmw-05638d0e"
      const segs = path.split("/");
      if ((segs[0] === "scan" || segs[0] === "s") && segs[1]) {
        return { code: segs[1] };
      }

      // (c) /booth/<id> 형태 지원
      if (segs[0] === "booth" && segs[1]) {
        return { b: segs[1] };
      }

      // (d) 그 외 URL은 최후 수단: 전체를 code로 넘김 (서버에서 후처리할 수 있게)
      return { code: t };
    } catch {
      // URL 파싱 실패 시 아래 일반 폴백으로
    }
  }

  // 4) 일반 문자열은 code로 처리
  return { code: t };
}

/* ---------- iOS / Safari / PWA(standalone) 감지 ---------- */
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

  const [torch, setTorch] = useState(false);
  const [msg, setMsg] = useState("카메라 준비 중…");
  const [last, setLast] = useState(null);
  const [manual, setManual] = useState("");

  // 카메라 선택/상태
  const [devices, setDevices] = useState([]); // [{id, label}]
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);

  // iOS UX 안내
  const [{ isIOS, isStandalone, isSafari }, setIOSCtx] = useState({ isIOS: false, isStandalone: false, isSafari: true });

  // 전송 가드: 짧은 쿨타임 & 중복 전송 방지
  const sendingRef = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // 디버그(스캔 에러 표시용)
  const [debug, setDebug] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  // 로그인 후 자동복귀 처리
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

  // 장치 목록 새로고침
  const refreshDevices = async () => {
    try {
      const cams = await QrScanner.listCameras(true); // [{id, label}]
      setDevices(cams);
      const saved = localStorage.getItem("vtb:lastDeviceId");
      if (saved && cams.some(c => c.id === saved)) {
        setDeviceId(saved);
      } else if (cams.length && !deviceId) {
        setDeviceId(cams[0].id);
      }
    } catch (e) {
      console.warn("카메라 목록 불러오기 실패", e);
    }
  };

  // 스캐너 시작
  useEffect(() => {
    let active = true;

    (async () => {
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

      try {
        setLoading(true);

        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (!active) return;
            const text = result?.data || result;
            if (sendingRef.current || cooldown > 0) return; // 중복 방지
            handleScanResult(text);
          },
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,

            // ▼ 디코딩 튜닝
            maxScansPerSecond: 8,                 // CPU 부하 대비 안정 속도
            preferredResolution: 1280,            // 낮으면 인식이 어려움 → 720~1280 권장
            // 반전된 코드(흰 바탕/검정 바코드가 아닌 경우)도 시도
            // @ts-ignore (옵션은 라이브러리 버전에 따라 다름)
            tryInverted: true,

            // 디버그: 실패 메시지 확인 (옵션 지원 버전)
            onDecodeError: (e) => {
              if (showDebug) setDebug(String(e?.message || e || ""));
            },
          }
        );
        scannerRef.current = scanner;

        await scanner.start();           // 권한 요청 + 비디오 attach
        await refreshDevices();          // 라벨 활성화 후 목록 로드

        const saved = localStorage.getItem("vtb:lastDeviceId");
        if (saved) {
          try {
            await scanner.setCamera(saved);
            setDeviceId(saved);
          } catch (e) {
            console.warn("저장된 카메라 전환 실패 → 기본 유지", e);
          }
        }

        setMsg("QR을 화면 중앙에 맞춰주세요.");
      } catch (e) {
        console.warn(e);
        setMsg("카메라 접근이 거부되었거나 사용할 수 없습니다.");
      } finally {
        setLoading(false);
      }
    })();

    const onDeviceChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

    return () => {
      active = false;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    };
  }, [cooldown, showDebug]);

  // 카메라 전환
  const handleChangeDevice = async (id) => {
    setDeviceId(id || null);
    if (!scannerRef.current) return;
    try {
      setLoading(true);
      setMsg("카메라 전환 중…");
      await scannerRef.current.setCamera(id); // deviceId 또는 'environment'/'user'
      if (id) localStorage.setItem("vtb:lastDeviceId", id);
      else localStorage.removeItem("vtb:lastDeviceId");
      setMsg("QR을 화면 중앙에 맞춰주세요.");
    } catch (e) {
      console.warn("카메라 전환 실패", e);
      setMsg("선택한 카메라를 사용할 수 없습니다. 다른 장치를 선택해 주세요.");
      try {
        await scannerRef.current.setCamera("environment");
        setMsg("후면 카메라로 폴백했습니다. 다시 시도해 주세요.");
      } catch {
        try {
          await scannerRef.current.setCamera("user");
          setMsg("전면 카메라로 폴백했습니다. 다시 시도해 주세요.");
        } catch {
          setMsg("폴백 실패: 브라우저 권한/HTTPS/다른 앱 점유를 확인해 주세요.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // 플래시 토글
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

  // 스캔 처리 (수정)
 async function handleScanResult(text) {
  const raw = String(text || "").trim();
  if (!raw) { setMsg("QR 형식이 올바르지 않습니다."); return; }

  // ✨ http/https 링크면 그냥 이동 (네이버 단축링크 포함)
  if (/^https?:\/\//i.test(raw)) {
    setMsg("링크로 이동 중…");
    location.href = raw;   // 리다이렉트는 브라우저가 따라가고,
    return;                // /scan/<slug>로 도착하면 [slug] 페이지가 code로 변환합니다.
  }

    //이하 기존 처리
    const payload = parseAnyText(text);
    if (!payload) {
      setMsg("QR 형식이 올바르지 않습니다.");
      return;
    }
    const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
    if (!me?.user?.id) {
      savePending(payload);
      location.href = `/login?next=${encodeURIComponent("/scan?auto=1")}`;
      return;
    }
    setMsg("전송 중…");
    await sendToServer(payload);
  }

  // 서버 전송(멱등 + 쿨타임)
  async function sendToServer(payload) {
    if (sendingRef.current || cooldown > 0) return; // 중복 방지
    sendingRef.current = true;
    setCooldown(2); // 2초 쿨다운
    setLast(payload);

    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, client_event_id: crypto.randomUUID?.() }),
      });

      if (r.status === 429) { // 레이트리밋 → 짧게 대기 후 1회 재시도
        await new Promise(res => setTimeout(res, 500));
        sendingRef.current = false;
        return await sendToServer(payload);
      }

      const j = await r.json().catch(() => ({}));
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

  /* -------------------- UI -------------------- */
  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold">QR 스캔</h1>

      {/* iPhone 최적화 안내 */}
      {isIOS && (
        <div className="text-xs rounded-lg border p-3 bg-amber-50 border-amber-200 text-amber-900">
          {!isSafari && (
            <p>iPhone에서는 <b>Safari 브라우저</b>에서 카메라 스캔이 가장 안정적으로 작동합니다.</p>
          )}
          {isStandalone && (
            <p className="mt-1">현재 <b>홈 화면(PWA) 모드</b>로 보이는 것 같아요. 카메라 권한 팝업이 표시되지 않을 수 있습니다. 문제가 있다면 Safari에서 직접 열어주세요.</p>
          )}
        </div>
      )}

      {/* 카메라 선택/제어 + 디버그 토글 */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-gray-600">카메라</label>
        <select
          className="border rounded px-3 py-2"
          value={deviceId || ""}
          onChange={(e) => handleChangeDevice(e.target.value || null)}
          disabled={loading}
        >
          <option value="">자동 선택(후면 우선)</option>
          {devices.map((d, i) => (
            <option key={d.id || `cam-${i}`} value={d.id}>
              {d.label || `카메라 ${i + 1}`}
            </option>
          ))}
        </select>
        <button
          className="border rounded px-3 py-2"
          onClick={() => handleChangeDevice(deviceId || "")}
          disabled={loading}
        >
          다시 시도
        </button>
        <button className="border rounded px-3 py-2" onClick={toggleTorch}>
          {torch ? "플래시 끄기" : "플래시 켜기"}
        </button>
        <label className="text-xs flex items-center gap-1 ml-auto cursor-pointer select-none">
          <input type="checkbox" checked={showDebug} onChange={(e)=>setShowDebug(e.target.checked)} />
          디코딩 디버그
        </label>

        {cooldown > 0 && (
          <span className="text-xs px-2 py-1 rounded border bg-gray-50 text-gray-700">
            {cooldown}s 대기 중…
          </span>
        )}
      </div>

      {/* 카메라 프리뷰 */}
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

      {/* 액션 버튼들 */}
      <div className="flex gap-2">
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
        <button
          className="border rounded px-3 py-2"
          onClick={() => (sendingRef.current || cooldown > 0) ? null : handleScanResult(manual)}
          disabled={cooldown > 0}
        >
          입력 처리
        </button>
      </div>

      {/* 상태/마지막 처리 + 디버그 */}
      <div className="space-y-1">
        <div className="text-sm text-gray-600">{msg}</div>
        {last && (
          <div className="text-xs text-gray-500 break-all">
            마지막 처리: {JSON.stringify(last)}
          </div>
        )}
        {showDebug && debug && (
          <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all border rounded p-2 bg-gray-50">
            {debug}
          </pre>
        )}
      </div>
    </div>
  );
}
